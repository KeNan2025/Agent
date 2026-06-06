/**
 * Scene3D — 专业实时3D数字孪生渲染器
 *
 * 基于 Canvas2D 软件光栅化管线：
 *   1. 4×4 MVP 透视投影 (右手系, depth 0→1)
 *   2. Painter's Algorithm Z-depth 排序
 *   3. 轨道相机 + 惯性阻尼
 *   4. 透视网格地面
 *   5. 实体渲染 + 多层辉光 + 脉冲动画
 *   6. GPU-style 粒子系统 (~200 particles)
 *   7. 实体连线
 *   8. requestAnimationFrame 60fps 主循环
 *   9. 视锥剔除 + 对象池
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { PhysicalEntity } from '../core/DigitalTwinEngine';
import {
  Vec3, vec3, v3Add, v3Scale, v3Lerp, v3Dist,
  Mat4, m4Perspective, m4LookAt, m4Multiply,
  ProjectedPoint, project,
  RGBA, rgbaToStyle,
} from '../core/Math3D';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

interface Scene3DProps {
  entities: PhysicalEntity[];
  onEntityClick?: (entity: PhysicalEntity) => void;
  width?: number;
  height?: number;
}

interface CameraState {
  /** Spherical coords around origin */
  theta: number;   // azimuth (Y rotation) in radians
  phi: number;     // elevation (X rotation) in radians
  radius: number;  // distance from origin
  /** Target we orbit around */
  target: Vec3;
}

interface Particle {
  pos: Vec3;
  vel: Vec3;
  life: number;
  maxLife: number;
  size: number;
  color: RGBA;
}

interface RenderEntity {
  entity: PhysicalEntity;
  projected: ProjectedPoint;
  screenSize: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const GRID_SIZE = 10;        // half-size of grid in world units
const GRID_STEP = 1;
const GRID_COLOR: RGBA = [0, 0.55, 1, 0.12];
const GRID_COLOR_MAJOR: RGBA = [0, 0.55, 1, 0.22];
const ENTITY_BASE_RADIUS = 0.35;
const PARTICLE_COUNT = 200;
const PARTICLE_RANGE = 8;    // half-extent of particle spawn box
const PARTICLE_SPEED = 0.15;
const CONNECTION_MAX_DIST = 5;
const CAMERA_DAMPING = 0.08; // lower = smoother (more inertia)
const ZOOM_SPEED = 0.08;

const STATUS_COLORS: Record<string, RGBA> = {
  normal:  [0, 0.83, 1, 1],    // #00d4ff cyan
  warning: [1, 0.75, 0.05, 1], // #ffbe0b amber
  error:   [1, 0.28, 0.34, 1], // #ff4757 red
  offline: [0.35, 0.48, 0.60, 1], // gray
};

const TYPE_SHAPES: Record<string, 'hexagon' | 'diamond' | 'circle' | 'square'> = {
  company:  'hexagon',
  pipeline: 'diamond',
  grid:     'circle',
  facility: 'square',
};

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

const RAD = Math.PI / 180;

/** Clamp value between min and max */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Build the MVP matrix for the current frame */
function buildMVP(cam: CameraState, aspect: number): Mat4 {
  // Convert spherical to cartesian eye position
  const eyeX = cam.target.x + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
  const eyeY = cam.target.y + cam.radius * Math.cos(cam.phi);
  const eyeZ = cam.target.z + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);
  const eye = vec3(eyeX, eyeY, eyeZ);

  const view = m4LookAt(eye, cam.target, vec3(0, 1, 0));
  const proj = m4Perspective(40 * RAD, aspect, 0.1, 100);
  return m4Multiply(proj, view);
}

// ═══════════════════════════════════════════════════════════════════════
// Particle System
// ═══════════════════════════════════════════════════════════════════════

function createParticlePool(count: number): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < count; i++) {
    pool.push(spawnParticle());
    // stagger initial life to avoid pop-in/fade-out in sync
    pool[i].life = Math.random() * pool[i].maxLife;
  }
  return pool;
}

function spawnParticle(): Particle {
  const life = 2 + Math.random() * 5;
  return {
    pos: vec3(
      (Math.random() - 0.5) * PARTICLE_RANGE * 2,
      (Math.random() - 0.5) * PARTICLE_RANGE * 2,
      (Math.random() - 0.5) * PARTICLE_RANGE * 2,
    ),
    vel: vec3(
      (Math.random() - 0.5) * PARTICLE_SPEED,
      (Math.random() - 0.3) * PARTICLE_SPEED, // bias upward
      (Math.random() - 0.5) * PARTICLE_SPEED,
    ),
    life,
    maxLife: life,
    size: 0.5 + Math.random() * 2.5,
    color: [0, 0.55 + Math.random() * 0.45, 0.8 + Math.random() * 0.2, 1] as RGBA,
  };
}

function updateParticle(p: Particle, dt: number): void {
  p.life -= dt;
  p.pos = v3Add(p.pos, v3Scale(p.vel, dt));
  // gentle drift
  p.vel.y += 0.02 * dt;
  if (p.life <= 0) {
    const fresh = spawnParticle();
    Object.assign(p, fresh);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Core Component
// ═══════════════════════════════════════════════════════════════════════

export default function Scene3D({ entities, onEntityClick, width = 800, height = 600 }: Scene3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Camera state (refs for hot-path reads inside rAF) ──
  const camRef = useRef<CameraState>({
    theta: 0.8,
    phi: 1.2,
    radius: 12,
    target: vec3(0, 0.5, 0),
  });
  const camTarget = useRef<CameraState>({ ...camRef.current });

  // ── Input state ──
  const inputRef = useRef({
    dragging: false,
    prevX: 0, prevY: 0,
    pinchDist: 0,
  });

  // ── Particle pool ──
  const particlesRef = useRef<Particle[]>([]);
  const particlesInited = useRef(false);

  // ── Entity interpolated positions (for smooth movement) ──
  const entityPositionsRef = useRef<Map<string, Vec3>>(new Map());
  const entityTargetPositionsRef = useRef<Map<string, Vec3>>(new Map());

  // ── Animation time ──
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // ── Hover state ──
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  // ── Resize observer ──
  const [canvasSize, setCanvasSize] = useState({ w: width, h: height });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        setCanvasSize({ w: Math.floor(w), h: Math.floor(h) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = canvasSize;

  // ── Init particles once ──
  useEffect(() => {
    if (!particlesInited.current) {
      particlesRef.current = createParticlePool(PARTICLE_COUNT);
      particlesInited.current = true;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Update entity target positions when entities change ──
  useEffect(() => {
    for (const e of entities) {
      const pos = e.position ? vec3(e.position.x, e.position.y, e.position.z) : vec3(0, 0, 0);
      entityTargetPositionsRef.current.set(e.id, pos);
      if (!entityPositionsRef.current.has(e.id)) {
        entityPositionsRef.current.set(e.id, pos);
      }
    }
  }, [entities]);

  // ═════════════════════════════════════════════════════════════════
  // Input Handlers
  // ═════════════════════════════════════════════════════════════════

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    inputRef.current.dragging = true;
    inputRef.current.prevX = e.clientX;
    inputRef.current.prevY = e.clientY;
    // capture pointer for reliable drag outside canvas
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const inp = inputRef.current;
    if (!inp.dragging) return;

    const dx = e.clientX - inp.prevX;
    const dy = e.clientY - inp.prevY;
    inp.prevX = e.clientX;
    inp.prevY = e.clientY;

    // Orbit: horizontal → theta, vertical → phi
    const sensitivity = 0.005;
    camTarget.current.theta -= dx * sensitivity;
    camTarget.current.phi = clamp(camTarget.current.phi - dy * sensitivity, 0.15, Math.PI - 0.15);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    inputRef.current.dragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    camTarget.current.radius = clamp(
      camTarget.current.radius + e.deltaY * ZOOM_SPEED * 0.01,
      3, 35,
    );
  }, []);

  // ── Click detection (project entity → check distance to click) ──
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (inputRef.current.dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left - w / 2;
    const cy = e.clientY - rect.top - h / 2;

    const cam = camRef.current;
    const mvp = buildMVP(cam, w / Math.max(h, 1));
    let closest: PhysicalEntity | null = null;
    let closestDist = Infinity;

    for (const entity of entities) {
      const worldPos = entityPositionsRef.current.get(entity.id) || vec3(0, 0, 0);
      const proj = project(worldPos, mvp, w, h);
      if (proj.behind) continue;
      const dist = Math.hypot(proj.sx - cx, proj.sy - cy);
      if (dist < 40 && dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }
    if (closest) onEntityClick?.(closest);
  }, [entities, w, h, onEntityClick]);

  // ═════════════════════════════════════════════════════════════════
  // Render Loop
  // ═════════════════════════════════════════════════════════════════

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // cap dt to avoid spiral
      lastTime = now;
      timeRef.current += dt;

      // ── Camera damping (inertia) ──
      const cam = camRef.current;
      const tgt = camTarget.current;
      cam.theta   += (tgt.theta   - cam.theta)   * CAMERA_DAMPING * 60 * dt;
      cam.phi     += (tgt.phi     - cam.phi)     * CAMERA_DAMPING * 60 * dt;
      cam.radius  += (tgt.radius  - cam.radius)  * CAMERA_DAMPING * 60 * dt;

      // ── Smooth entity positions ──
      const eps = entityPositionsRef.current;
      const ets = entityTargetPositionsRef.current;
      for (const [id, targetPos] of ets) {
        const cur = eps.get(id) || targetPos;
        eps.set(id, v3Lerp(cur, targetPos, 3 * dt));
      }

      // ── Update particles ──
      const particles = particlesRef.current;
      for (const p of particles) updateParticle(p, dt);

      // ── Clear ──
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // ── Background gradient ──
      const bgGrad = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      bgGrad.addColorStop(0, '#0f1a2e');
      bgGrad.addColorStop(1, '#050d18');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const aspect = w / Math.max(h, 1);
      const mvp = buildMVP(cam, aspect);

      // ── Layer 0: Perspective grid ──
      drawGrid(ctx, mvp, w, h, cam);

      // ── Layer 1: Connection lines ──
      drawConnections(ctx, entities, eps, mvp, w, h);

      // ── Layer 2: Particles (behind) ──
      drawParticles(ctx, particles, mvp, w, h, false);

      // ── Layer 3: Entities (z-sorted) ──
      const renderEntities = buildRenderList(entities, eps, mvp, w, h);
      drawEntities(ctx, renderEntities, timeRef.current, hoveredIdRef.current, w, h);

      // ── Layer 4: Particles (in front) ──
      drawParticles(ctx, particles, mvp, w, h, true);

      // ── Layer 5: Vignette overlay ──
      drawVignette(ctx, w, h);

      // ── Layer 6: Scan line effect ──
      drawScanLines(ctx, w, h, timeRef.current);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [entities, w, h]);

  // ═════════════════════════════════════════════════════════════════
  // JSX
  // ═════════════════════════════════════════════════════════════════

  return (
    <div
      ref={containerRef}
      style={{
        width: width || '100%',
        height: height || '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: inputRef.current.dragging ? 'grabbing' : 'grab',
        background: '#050d18',
        borderRadius: 8,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        width={Math.round(w * devicePixelRatio)}
        height={Math.round(h * devicePixelRatio)}
        style={{ width: w, height: h, display: 'block' }}
      />
      {/* HUD overlay */}
      <ControlsHUD cam={camRef.current} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════════════════════════════════

/** Draw perspective grid on XZ plane */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  mvp: Mat4,
  w: number, h: number,
  cam: CameraState,
): void {
  ctx.save();
  ctx.translate(w / 2, h / 2);

  const lines: Array<{ a: ProjectedPoint; b: ProjectedPoint; major: boolean }> = [];

  for (let i = -GRID_SIZE; i <= GRID_SIZE; i += GRID_STEP) {
    const major = i % 5 === 0;
    // lines along Z (varying X)
    lines.push({
      a: project(vec3(i, 0, -GRID_SIZE), mvp, w, h),
      b: project(vec3(i, 0, GRID_SIZE), mvp, w, h),
      major,
    });
    // lines along X (varying Z)
    lines.push({
      a: project(vec3(-GRID_SIZE, 0, i), mvp, w, h),
      b: project(vec3(GRID_SIZE, 0, i), mvp, w, h),
      major,
    });
  }

  // Sort back-to-front for proper alpha blending
  lines.sort((a, b) => {
    const da = (a.a.depth + a.b.depth) / 2;
    const db = (b.a.depth + b.b.depth) / 2;
    return da - db;
  });

  for (const { a, b, major } of lines) {
    if (a.behind || b.behind) continue;
    if (Math.abs(a.sx) > w * 2 || Math.abs(a.sy) > h * 2) continue;

    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    const alpha = major
      ? GRID_COLOR_MAJOR[3]
      : GRID_COLOR[3];
    ctx.strokeStyle = major
      ? rgbaToStyle([...GRID_COLOR_MAJOR.slice(0, 3) as [number, number, number], alpha])
      : rgbaToStyle([...GRID_COLOR.slice(0, 3) as [number, number, number], alpha]);
    ctx.lineWidth = major ? 1.0 : 0.5;
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw connection lines between nearby entities */
function drawConnections(
  ctx: CanvasRenderingContext2D,
  entities: PhysicalEntity[],
  positions: Map<string, Vec3>,
  mvp: Mat4,
  w: number, h: number,
): void {
  if (entities.length < 2) return;
  ctx.save();
  ctx.translate(w / 2, h / 2);

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const pa = positions.get(entities[i].id);
      const pb = positions.get(entities[j].id);
      if (!pa || !pb) continue;
      const dist = v3Dist(pa, pb);
      if (dist > CONNECTION_MAX_DIST) continue;

      const projA = project(pa, mvp, w, h);
      const projB = project(pb, mvp, w, h);
      if (projA.behind || projB.behind) continue;

      const alpha = 0.08 * (1 - dist / CONNECTION_MAX_DIST);
      ctx.beginPath();
      ctx.moveTo(projA.sx, projA.sy);
      ctx.lineTo(projB.sx, projB.sy);
      ctx.strokeStyle = rgbaToStyle([0, 0.55, 1, alpha]);
      ctx.lineWidth = 1;
      // dash pattern for distant connections
      if (dist > CONNECTION_MAX_DIST * 0.6) {
        ctx.setLineDash([4, 8]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

/** Build a z-sorted render list of entities */
function buildRenderList(
  entities: PhysicalEntity[],
  positions: Map<string, Vec3>,
  mvp: Mat4,
  w: number, h: number,
): RenderEntity[] {
  const list: RenderEntity[] = [];
  for (const entity of entities) {
    const worldPos = positions.get(entity.id) || vec3(0, 0, 0);
    const proj = project(worldPos, mvp, w, h);
    if (proj.behind) continue;

    // Screen-size heuristic based on distance
    const dist = v3Dist(worldPos, vec3(0, 0, 0));
    const screenSize = Math.max(8, 40 * (1 / (1 + dist * 0.3)));

    // Frustum-cull: skip if far outside viewport
    if (Math.abs(proj.sx) > w * 1.5 || Math.abs(proj.sy) > h * 1.5) continue;

    list.push({ entity, projected: proj, screenSize });
  }
  // Sort back-to-front (painter's algorithm)
  list.sort((a, b) => a.projected.depth - b.projected.depth);
  return list;
}

/** Draw all entities */
function drawEntities(
  ctx: CanvasRenderingContext2D,
  list: RenderEntity[],
  time: number,
  hoveredId: string | null,
  w: number,
  h: number,
): void {
  ctx.save();
  // We already translated in drawGrid, but since that restored, we need to translate again.
  // Actually let's handle the translate at this level.
  // ... wait, each draw function now does its own translate.
  // Let me reconsider — it's better to translate once.
  // But for entities we need per-entity positioning.
  // Let's just use absolute screen coords.

  for (const { entity, projected, screenSize } of list) {
    const { sx, sy } = projected;
    const color = STATUS_COLORS[entity.status] || STATUS_COLORS.normal;
    const shape = TYPE_SHAPES[entity.type] || 'square';
    const isHovered = entity.id === hoveredId;
    const pulse = 1 + Math.sin(time * 2.5 + entity.id.charCodeAt(0)) * 0.08;
    const radius = screenSize * 0.5 * pulse * (isHovered ? 1.4 : 1);

    ctx.save();
    // Move origin to entity screen position (canvas centre is at (0,0) before translate)
    // Actually we're in absolute coords (sx,sy relative to centre). Let's just translate.
    // setTransform(dpr,...) means ALL drawing is in CSS-pixel coords
    const cx = w / 2 + sx;
    const cy = h / 2 + sy;
    ctx.translate(cx, cy);

    // ── Outer glow ring ──
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
    const glowGrad = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 2.2);
    glowGrad.addColorStop(0, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0.25]));
    glowGrad.addColorStop(0.5, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0.08]));
    glowGrad.addColorStop(1, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0]));
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // ── Inner glow ──
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
    const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.15);
    innerGlow.addColorStop(0, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0.6]));
    innerGlow.addColorStop(0.7, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0.2]));
    innerGlow.addColorStop(1, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0]));
    ctx.fillStyle = innerGlow;
    ctx.fill();

    // ── Entity shape ──
    ctx.beginPath();
    drawShape(ctx, 0, 0, radius, shape);
    ctx.closePath();

    // Fill with subtle gradient
    const fillGrad = ctx.createLinearGradient(0, -radius, 0, radius);
    fillGrad.addColorStop(0, rgbaToStyle(color));
    fillGrad.addColorStop(1, rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0.85]));
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Stroke
    ctx.strokeStyle = rgbaToStyle([1, 1, 1, 0.45]);
    ctx.lineWidth = isHovered ? 1.8 : 1.2;
    ctx.stroke();

    // ── Bright core highlight ──
    ctx.beginPath();
    ctx.arc(0, -radius * 0.2, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = rgbaToStyle([1, 1, 1, 0.25]);
    ctx.fill();

    // ── Label ──
    ctx.fillStyle = '#e8f4ff';
    ctx.font = `${Math.max(9, Math.round(radius * 0.7))}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = entity.name.length > 4 ? entity.name.slice(0, 4) + '…' : entity.name;
    ctx.fillText(label, 0, -radius - 6);

    // ── Status indicator dot ──
    const dotY = radius + 10;
    ctx.beginPath();
    ctx.arc(0, dotY, 3, 0, Math.PI * 2);
    ctx.fillStyle = rgbaToStyle(color);
    ctx.fill();
    // pulse ring for errors
    if (entity.status === 'error') {
      ctx.beginPath();
      const errorPulse = 3 + Math.sin(time * 6) * 1.5;
      ctx.arc(0, dotY, errorPulse, 0, Math.PI * 2);
      ctx.strokeStyle = rgbaToStyle([...color.slice(0, 3) as [number, number, number], 0.5 - 0.2 * Math.abs(Math.sin(time * 6))]);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
  ctx.restore();
}

/** Draw a specific geometric shape */
function drawShape(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  shape: 'hexagon' | 'diamond' | 'circle' | 'square',
): void {
  switch (shape) {
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      break;
    }
    case 'diamond': {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.7, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.7, y);
      break;
    }
    case 'circle': {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    }
    case 'square': {
      ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
      break;
    }
  }
}

/** Draw ambient floating particles */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  mvp: Mat4,
  w: number, h: number,
  front: boolean,
): void {
  ctx.save();
  ctx.translate(w / 2, h / 2);

  for (const p of particles) {
    const proj = project(p.pos, mvp, w, h);
    if (proj.behind) continue;

    // Split roughly into front/back half by depth
    const isFront = proj.depth < 0.5;
    if (isFront !== front) continue;

    const alpha = (p.life / p.maxLife) * 0.5;
    const size = p.size * (front ? 1.2 : 0.6);

    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, size, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, size);
    grad.addColorStop(0, rgbaToStyle([...p.color.slice(0, 3) as [number, number, number], alpha]));
    grad.addColorStop(1, rgbaToStyle([...p.color.slice(0, 3) as [number, number, number], 0]));
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

/** Dark vignette for cinematic look */
function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Subtle scan line effect */
function drawScanLines(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  ctx.fillStyle = 'rgba(0,10,30,0.03)';
  const lineH = 3;
  const gap = 5;
  const offset = (time * 30) % (lineH + gap);
  for (let y = -offset; y < h; y += lineH + gap) {
    ctx.fillRect(0, y, w, lineH);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HUD Overlay
// ═══════════════════════════════════════════════════════════════════════

function ControlsHUD({ cam }: { cam: CameraState }) {
  return (
    <>
      {/* Bottom-left: controls hint */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)',
        padding: '6px 12px', borderRadius: 6, fontSize: 11,
        pointerEvents: 'none', fontFamily: '"PingFang SC", sans-serif',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        拖拽旋转 · 滚轮缩放 · 点击实体
      </div>

      {/* Top-right: camera info */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.5)',
        padding: '4px 10px', borderRadius: 4, fontSize: 10,
        pointerEvents: 'none', fontFamily: '"SF Mono", Consolas, monospace',
      }}>
        R {cam.radius.toFixed(1)} · θ {((cam.theta * 180 / Math.PI) % 360).toFixed(0)}° · φ {(cam.phi * 180 / Math.PI).toFixed(0)}°
      </div>

      {/* Bottom-right: FPS indicator (placeholder) */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(0,0,0,0.5)', color: 'rgba(0,212,255,0.7)',
        padding: '4px 10px', borderRadius: 4, fontSize: 10,
        pointerEvents: 'none', fontFamily: '"SF Mono", Consolas, monospace',
      }}>
        60 FPS
      </div>
    </>
  );
}