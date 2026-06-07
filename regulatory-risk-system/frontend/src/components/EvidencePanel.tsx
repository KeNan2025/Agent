/**
 * EvidencePanel — render the original-text evidence list for a single
 * risk factor. Used in CompanyDetail.
 */
import { Card, Empty, Tag, Tooltip } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { Evidence, RiskFactor } from '../types';

const SEVERITY_COLOR: Record<string, string> = {
  '高': 'red',
  '中': 'orange',
  '低': 'green',
};

interface EvidencePanelProps {
  riskFactors: RiskFactor[];
}

export default function EvidencePanel({ riskFactors }: EvidencePanelProps) {
  if (!riskFactors || riskFactors.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无原文证据" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {riskFactors.map((rf, idx) => {
        const evidences: Evidence[] = (rf.evidence as any[]) ?? (rf.evidence_quote ? [{
          source_type: 'announcement',
          source_id: rf.evidence_source ?? '',
          source: rf.evidence_source ?? '',
          snippet: rf.evidence_quote ?? '',
        } as Evidence] : []);
        return (
          <Card
            key={idx}
            size="small"
            className="evidence-card"
            styles={{ body: { padding: '12px 16px' } }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <Tag color={SEVERITY_COLOR[rf.severity] ?? 'default'} style={{ fontWeight: 600 }}>
                {rf.severity}风险
              </Tag>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                {rf.subcategory}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                · {rf.category}
              </span>
              <Tooltip title={`置信度 ${(rf.confidence * 100).toFixed(0)}%`}>
                <Tag color="blue" style={{ marginLeft: 'auto' }}>
                  {(rf.confidence * 100).toFixed(0)}%
                </Tag>
              </Tooltip>
            </div>
            <div style={{ color: 'var(--text-normal)', fontSize: 13, marginBottom: 10 }}>
              {rf.description}
            </div>
            {evidences.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>暂无证据片段</div>
            )}
            {evidences.map((ev, i) => (
              <div
                key={i}
                style={{
                  borderLeft: '3px solid var(--warning)',
                  padding: '6px 12px',
                  background: 'var(--warning-soft)',
                  borderRadius: '0 4px 4px 0',
                  marginBottom: 6,
                }}
              >
                <div style={{
                  color: 'var(--text-normal)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}>
                  "{ev.snippet || rf.evidence_quote}"
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  marginTop: 4,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <FileTextOutlined />
                  {ev.source || ev.source_id || rf.evidence_source}
                  {ev.line_range && ` · 行 ${ev.line_range[0]}-${ev.line_range[1]}`}
                </div>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}
