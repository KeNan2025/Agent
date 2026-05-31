/**
 * 3D场景组件 - 数字孪生三维可视化
 * 使用CSS 3D Transform实现，无需额外依赖
 */

import { useEffect, useRef, useState } from 'react';
import { PhysicalEntity } from '../core/DigitalTwinEngine';

interface Scene3DProps {
  entities: PhysicalEntity[];
  onEntityClick?: (entity: PhysicalEntity) => void;
  width?: number;
  height?: number;
}

export default function Scene3D({ entities, onEntityClick, width = 800, height = 600 }: Scene3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 20, y: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 鼠标拖拽旋转
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setRotation({
      x: rotation.x + deltaY * 0.5,
      y: rotation.y + deltaX * 0.5,
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 根据实体类型获取颜色
  const getEntityColor = (entity: PhysicalEntity): string => {
    switch (entity.status) {
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'offline':
        return '#6b7280';
      default:
        return '#3b82f6';
    }
  };

  // 根据实体类型获取形状
  const getEntityShape = (entity: PhysicalEntity): string => {
    switch (entity.type) {
      case 'company':
        return 'cube';
      case 'pipeline':
        return 'cylinder';
      case 'grid':
        return 'sphere';
      default:
        return 'cube';
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        perspective: '1000px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 3D场景容器 */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
        }}
      >
        {/* 网格地面 */}
        <div
          style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotateX(90deg) translateZ(-200px)',
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            opacity: 0.3,
          }}
        />

        {/* 渲染实体 */}
        {entities.map((entity) => {
          const pos = entity.position || { x: 0, y: 0, z: 0 };
          const color = getEntityColor(entity);
          const shape = getEntityShape(entity);

          return (
            <div
              key={entity.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `
                  translate(-50%, -50%)
                  translate3d(${pos.x * 50}px, ${-pos.y * 50}px, ${pos.z * 50}px)
                `,
                transformStyle: 'preserve-3d',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEntityClick?.(entity);
              }}
            >
              {/* 实体主体 */}
              {shape === 'cube' && (
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    background: color,
                    boxShadow: `0 0 20px ${color}`,
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {entity.name.substring(0, 2)}
                </div>
              )}

              {shape === 'sphere' && (
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    background: color,
                    boxShadow: `0 0 20px ${color}`,
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {entity.name.substring(0, 2)}
                </div>
              )}

              {shape === 'cylinder' && (
                <div
                  style={{
                    width: '30px',
                    height: '60px',
                    background: `linear-gradient(to bottom, ${color}, ${color}dd)`,
                    boxShadow: `0 0 20px ${color}`,
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {entity.name.substring(0, 2)}
                </div>
              )}

              {/* 实体标签 */}
              <div
                style={{
                  position: 'absolute',
                  top: '-30px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                {entity.name}
              </div>

              {/* 状态指示器 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 10px ${color}`,
                  animation: entity.status === 'error' ? 'pulse 1s infinite' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* 控制提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          pointerEvents: 'none',
        }}
      >
        拖拽旋转视角 | 点击实体查看详情
      </div>

      {/* 坐标轴指示器 */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '80px',
          height: '80px',
          perspective: '500px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transition: 'transform 0.3s ease-out',
          }}
        >
          {/* X轴 - 红色 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '40px',
              height: '2px',
              background: '#ef4444',
              transform: 'translate(-50%, -50%) rotateY(0deg)',
            }}
          />
          {/* Y轴 - 绿色 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '2px',
              height: '40px',
              background: '#22c55e',
              transform: 'translate(-50%, -50%)',
            }}
          />
          {/* Z轴 - 蓝色 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '40px',
              height: '2px',
              background: '#3b82f6',
              transform: 'translate(-50%, -50%) rotateY(90deg)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.5; transform: translateX(-50%) scale(1.5); }
        }
      `}</style>
    </div>
  );
}
