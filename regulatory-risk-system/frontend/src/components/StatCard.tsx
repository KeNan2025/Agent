import { Card, Statistic } from 'antd';
import type { ReactNode, CSSProperties } from 'react';

type StatColor = 'blue' | 'red' | 'orange' | 'green' | 'purple' | 'cyan';

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: ReactNode;
  color?: StatColor;
  icon?: ReactNode;
  valueStyle?: CSSProperties;
  size?: 'default' | 'small';
}

export default function StatCard({
  title,
  value,
  suffix,
  prefix,
  color = 'blue',
  icon,
  valueStyle,
  size = 'default',
}: StatCardProps) {
  return (
    <Card
      className={`stat-card stat-${color}`}
      styles={{ body: { padding: size === 'small' ? '14px 18px' : '18px 22px' } }}
    >
      {icon && <span className="stat-icon-bg">{icon}</span>}
      <Statistic
        title={<span className="stat-label">{title}</span>}
        value={value}
        suffix={suffix}
        prefix={prefix}
        valueStyle={{
          color: 'var(--text-bright)',
          fontSize: size === 'small' ? 22 : 28,
          fontWeight: 700,
          ...valueStyle,
        }}
      />
    </Card>
  );
}
