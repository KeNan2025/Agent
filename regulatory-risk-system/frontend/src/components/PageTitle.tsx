import type { ReactNode } from 'react';

interface PageTitleProps {
  title: string;
  extra?: ReactNode;
}

export default function PageTitle({ title, extra }: PageTitleProps) {
  return (
    <div className="page-title" style={extra ? { justifyContent: 'space-between' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="title-bar" />
        <span className="page-title-text">{title}</span>
      </div>
      {extra && <div>{extra}</div>}
    </div>
  );
}
