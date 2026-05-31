/**
 * 3D 数学引擎 — 向量、矩阵、投影、四元数
 * 纯数学库，不依赖任何外部包。
 * 用于驱动 Canvas2D 软件光栅化的数字孪生场景。
 */

// ── Types ──

export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }
export interface Vec4 { x: number; y: number; z: number; w: number }
export type Mat4 = Float32Array; // column-major 4×4, length 16

// ── Vec3 ──

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const v3Add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const v3Sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const v3Scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const v3Len = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
export const v3Normalize = (v: Vec3): Vec3 => {
  const l = v3Len(v);
  return l < 1e-9 ? vec3(0, 0, 0) : { x: v.x / l, y: v.y / l, z: v.z / l };
};
export const v3Cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const v3Dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const v3Lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const v3Dist = (a: Vec3, b: Vec3): number => v3Len(v3Sub(a, b));

// ── Mat4 (column-major Float32Array) ──

export const m4Identity = (): Mat4 => new Float32Array([
  1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1,
]);

export const m4Multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row]      * b[col * 4] +
        a[row + 4]  * b[col * 4 + 1] +
        a[row + 8]  * b[col * 4 + 2] +
        a[row + 12] * b[col * 4 + 3];
    }
  }
  return out;
};

/** Construct a perspective projection matrix (right-handed, depth 0→1) */
export const m4Perspective = (fovYRad: number, aspect: number, near: number, far: number): Mat4 => {
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far * nf;
  out[11] = -1;
  out[14] = near * far * nf;
  return out;
};

/** Construct a look-at view matrix */
export const m4LookAt = (eye: Vec3, center: Vec3, up: Vec3): Mat4 => {
  const f = v3Normalize(v3Sub(center, eye));
  const s = v3Normalize(v3Cross(f, up));
  const u = v3Cross(s, f);
  const out = new Float32Array(16);
  out[0] = s.x;  out[4] = s.y;  out[8]  = s.z;  out[12] = -v3Dot(s, eye);
  out[1] = u.x;  out[5] = u.y;  out[9]  = u.z;  out[13] = -v3Dot(u, eye);
  out[2] = -f.x; out[6] = -f.y; out[10] = -f.z; out[14] = v3Dot(f, eye);
  out[3] = 0;    out[7] = 0;    out[11] = 0;    out[15] = 1;
  return out;
};

/** Translation matrix */
export const m4Translate = (x: number, y: number, z: number): Mat4 => {
  const out = m4Identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
};

/** Scale matrix */
export const m4Scale = (sx: number, sy: number, sz: number): Mat4 => {
  const out = m4Identity();
  out[0] = sx; out[5] = sy; out[10] = sz;
  return out;
};

/** Rotation around X axis */
export const m4RotateX = (rad: number): Mat4 => {
  const c = Math.cos(rad), s = Math.sin(rad);
  const out = m4Identity();
  out[5] = c; out[6] = s;
  out[9] = -s; out[10] = c;
  return out;
};

/** Rotation around Y axis */
export const m4RotateY = (rad: number): Mat4 => {
  const c = Math.cos(rad), s = Math.sin(rad);
  const out = m4Identity();
  out[0] = c; out[8] = -s;
  out[2] = s; out[10] = c;
  return out;
};

// ── Projection ──

export interface ProjectedPoint {
  /** Screen-space x (pixels from canvas centre) */
  sx: number;
  /** Screen-space y (pixels from canvas centre) */
  sy: number;
  /** NDC depth 0→1 */
  depth: number;
  /** World-space position (for z-sorting) */
  world: Vec3;
  /** Whether the point is behind the camera */
  behind: boolean;
}

/**
 * Project a world-space Vec3 through a modelViewProjection matrix onto screen.
 * Returns screen coords relative to canvas centre.
 */
export const project = (v: Vec3, mvp: Mat4, w: number, h: number): ProjectedPoint => {
  const x = v.x, y = v.y, z = v.z;
  // clip-space
  const cx = mvp[0] * x + mvp[4] * y + mvp[8]  * z + mvp[12];
  const cy = mvp[1] * x + mvp[5] * y + mvp[9]  * z + mvp[13];
  const cz = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14];
  const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];

  const behind = cw <= 1e-6;
  const invW = behind ? 1 : 1 / cw;

  return {
    sx: (cx * invW) * w * 0.5,
    sy: -(cy * invW) * h * 0.5,
    depth: cz * invW,
    world: v,
    behind,
  };
};

// ── Quaternion (for smooth camera rotation) ──

export interface Quat { x: number; y: number; z: number; w: number }

export const quatIdentity = (): Quat => ({ x: 0, y: 0, z: 0, w: 1 });

export const quatFromAxisAngle = (axis: Vec3, angle: number): Quat => {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
};

export const quatMultiply = (a: Quat, b: Quat): Quat => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});

export const quatSlerp = (a: Quat, b: Quat, t: number): Quat => {
  let cosom = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  // flip if necessary
  let bFlip = b;
  if (cosom < 0) {
    cosom = -cosom;
    bFlip = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
  }
  const k0 = cosom > 0.9999 ? 1 - t : Math.sin((1 - t) * Math.acos(cosom)) / Math.sin(Math.acos(cosom));
  const k1 = cosom > 0.9999 ? t     : Math.sin(t * Math.acos(cosom))      / Math.sin(Math.acos(cosom));
  return {
    x: a.x * k0 + bFlip.x * k1,
    y: a.y * k0 + bFlip.y * k1,
    z: a.z * k0 + bFlip.z * k1,
    w: a.w * k0 + bFlip.w * k1,
  };
};

// ── Colour helpers ──

export type RGBA = [number, number, number, number]; // 0-1

export const hexToRgba = (hex: string, alpha = 1): RGBA => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255) as RGBA;
};

export const rgbaToStyle = (c: RGBA): string =>
  `rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${c[3]})`;