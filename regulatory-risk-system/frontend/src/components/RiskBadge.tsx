interface RiskBadgeProps {
  level: string;
}

function getModifier(level: string): string {
  if (level.includes('高')) return 'high';
  if (level.includes('中')) return 'medium';
  return 'low';
}

export default function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span className={`risk-badge risk-badge--${getModifier(level)}`}>
      {level}
    </span>
  );
}
