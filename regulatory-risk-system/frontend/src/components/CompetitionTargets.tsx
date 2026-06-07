/**
 * CompetitionTargets — 4 small MetricGate cards summarising the
 * project's pass/fail against the competition's hard targets.
 */
import { Col, Row } from 'antd';
import MetricGate from './MetricGate';

interface CompetitionTargetsProps {
  aucRoc: number;
  f1: number;
  top10Recall: number;
  /** Optional: focus classification accuracy (target ≥ 0.8) */
  focusAccuracy?: number;
}

export default function CompetitionTargets({
  aucRoc, f1, top10Recall, focusAccuracy,
}: CompetitionTargetsProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={6}>
        <MetricGate label="AUC-ROC" value={aucRoc} target={0.75} format="num" decimals={3} />
      </Col>
      <Col xs={12} sm={6}>
        <MetricGate label="F1-Score" value={f1} target={0.65} format="num" decimals={3} />
      </Col>
      <Col xs={12} sm={6}>
        <MetricGate label="Top-10% 召回" value={top10Recall} target={0.35} format="percent" />
      </Col>
      {focusAccuracy != null && (
        <Col xs={12} sm={6}>
          <MetricGate label="关注点分类准确率" value={focusAccuracy} target={0.8} format="percent" />
        </Col>
      )}
    </Row>
  );
}
