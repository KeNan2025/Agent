/**
 * LiveTracePanel — live-stream agent trace events for an in-flight scan
 * via WebSocket. Used in CompanyDetail and on the Tasks page.
 */
import { Badge, Card, Empty, Spin, Tag, Timeline } from 'antd';
import {
  ClockCircleOutlined, ThunderboltOutlined, WifiOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useScanWebSocket } from '../hooks/useScanWebSocket';

interface LiveTracePanelProps {
  scanId: string | null;
  height?: number;
}

const STATUS_TAG = {
  idle:       { color: 'default', text: '未连接' },
  connecting: { color: 'processing', text: '连接中' },
  open:       { color: 'success', text: '已连接' },
  closed:     { color: 'default', text: '已断开' },
  error:      { color: 'error', text: '出错' },
} as const;

export default function LiveTracePanel({ scanId, height = 380 }: LiveTracePanelProps) {
  const { events, status, error } = useScanWebSocket(scanId);
  const tag = STATUS_TAG[status];
  const complete = events.find((e) => e.type === 'scan_complete');

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOutlined style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600 }}>实时 Agent 追踪</span>
          <Badge status={tag.color as any} text={tag.text} />
        </span>
      }
      extra={
        complete && (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            {complete.risk_level} · {Number(complete.probability ?? 0).toFixed(2)}
          </Tag>
        )
      }
    >
      {!scanId && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="待扫描启动后实时显示 Agent 推理链路"
        />
      )}
      {scanId && status === 'connecting' && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="连接中..." />
        </div>
      )}
      {scanId && error && (
        <Tag color="red" icon={<CloseCircleOutlined />}>{error}</Tag>
      )}
      {scanId && events.length > 0 && (
        <div style={{ maxHeight: height, overflow: 'auto', paddingRight: 8 }}>
          <Timeline
            items={events
              .filter((e) => e.type === 'trace')
              .map((e, i) => ({
                key: i,
                color: 'blue',
                dot: <ClockCircleOutlined />,
                children: (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag color="blue">{e.node_name}</Tag>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}>
                        {e.action}
                      </span>
                      <span style={{
                        marginLeft: 'auto', fontSize: 11,
                        color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums',
                      }}>
                        <ClockCircleOutlined style={{ marginRight: 3 }} />
                        {e.duration_ms} ms
                        {e.tokens_used != null && e.tokens_used > 0 && (
                          <span style={{ marginLeft: 6 }}>
                            <ThunderboltOutlined style={{ marginRight: 3 }} />
                            {e.tokens_used} t
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-normal)' }}>
                      {e.output_summary}
                    </div>
                  </div>
                ),
              }))}
          />
        </div>
      )}
    </Card>
  );
}
