import { Card } from 'antd';
import type { CardProps, ReactNode } from 'antd';

interface DataCardProps extends CardProps {
  icon?: ReactNode;
  titleText?: string;
  tag?: { text: string; color?: string };
}

export default function DataCard({
  icon,
  titleText,
  tag,
  title,
  ...rest
}: DataCardProps) {
  const resolvedTitle = title ?? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
      <span>{titleText}</span>
      {tag && (
        <span
          className="module-tag"
          style={{
            background: tag.color ? `${tag.color}18` : 'var(--primary-dim)',
            color: tag.color || 'var(--primary)',
          }}
        >
          {tag.text}
        </span>
      )}
    </div>
  );

  return <Card title={resolvedTitle} {...rest} />;
}
