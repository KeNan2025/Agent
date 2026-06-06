import { Progress } from 'antd';
import { probabilityColor } from '../utils/format';

interface ProbabilityBarProps {
  /** 0-1 float or 0-100 integer */
  value: number;
  /** If true (default), value is treated as 0-1 and multiplied by 100 */
  normalized?: boolean;
  /** Show percentage text (default true) */
  showValue?: boolean;
  /** Max bar width in px (default 110) */
  maxWidth?: number;
  /** Color mode: 'risk' uses threshold colors, 'auto' uses primary */
  colorMode?: 'risk' | 'auto';
  size?: 'small' | 'default';
}

export default function ProbabilityBar({
  value,
  normalized = true,
  showValue = true,
  maxWidth = 110,
  colorMode = 'risk',
  size = 'default',
}: ProbabilityBarProps) {
  const pct = normalized ? value * 100 : value;
  const color = colorMode === 'risk' ? probabilityColor(normalized ? value : value / 100) : 'var(--primary)';

  return (
    <div className="prob-cell">
      <Progress
        className="prob-progress"
        percent={pct}
        showInfo={false}
        size={size === 'small' ? 'small' : 'default'}
        strokeColor={color}
        style={{ maxWidth }}
      />
      {showValue && (
        <span className="prob-value" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
