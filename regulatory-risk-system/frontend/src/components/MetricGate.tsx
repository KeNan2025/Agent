/**
 * MetricGate — show one competition target with pass/fail badge.
 *
 * Usage:
 *   <MetricGate label="AUC-ROC" value={0.81} target={0.75} format="num" />
 */
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

interface MetricGateProps {
  label: string;
  value: number;
  target: number;
  format?: 'percent' | 'num';
  decimals?: number;
}

export default function MetricGate({
  label, value, target, format = 'num', decimals = 3,
}: MetricGateProps) {
  const pass = value >= target;
  const color = pass ? 'var(--success)' : 'var(--danger)';
  const shown = format === 'percent'
    ? `${(value * 100).toFixed(1)}%`
    : value.toFixed(decimals);
  const targetShown = format === 'percent'
    ? `≥ ${(target * 100).toFixed(0)}%`
    : `≥ ${target}`;
  return (
    <div
      className="metric-gate"
      style={{
        padding: '14px 18px',
        borderRadius: 10,
        border: `1px solid ${pass ? 'rgba(82,196,26,0.3)' : 'rgba(255,77,79,0.3)'}`,
        background: pass ? 'var(--success-soft)' : 'var(--danger-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 140,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
        {pass
          ? <CheckCircleFilled style={{ color: 'var(--success)' }} />
          : <CloseCircleFilled style={{ color: 'var(--danger)' }} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {shown}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>目标 {targetShown}</div>
    </div>
  );
}
