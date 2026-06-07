/**
 * Tasks — async task tracker.
 *
 * Use case: `/scan/single?async_mode=true` returns a task_id; users
 * paste it here to see status + the live WebSocket trace.
 */
import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Input, Row, Spin, Tag,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, SearchOutlined,
} from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import LiveTracePanel from '../components/LiveTracePanel';
import { useTaskStatus } from '../hooks/useTaskStatus';
import type { AsyncTaskStatus } from '../types';

const STATUS_META: Record<AsyncTaskStatus, { color: string; icon: any; text: string }> = {
  pending:   { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
  running:   { color: 'processing', icon: <LoadingOutlined spin />, text: '运行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
  failed:    { color: 'error', icon: <CloseCircleOutlined />, text: '已失败' },
};

export default function Tasks() {
  const [params] = useSearchParams();
  const [taskId, setTaskId] = useState<string>(() => params.get('task_id') ?? '');
  const [scanId, setScanId] = useState<string | null>(null);
  const { task, error } = useTaskStatus(taskId || null);

  // Derive scan_id from task output (when scan task completes, output
  // includes company_code/probability; the underlying scan_id is the
  // task_id with `task_` prefix replaced).
  useEffect(() => {
    if (!task || !taskId) return;
    // The task_id and scan_id are independent. We use task_id directly
    // as the channel key for WS; backend publishes to scan:{scan_id}.
    // We expose the WS panel only for completed/running scan tasks.
    setScanId(taskId);
  }, [task, taskId]);

  const meta = task ? STATUS_META[task.status] : null;

  return (
    <div className="page-container fade-in">
      <PageTitle title="异步任务" />

      <Card style={{ marginBottom: 20 }}>
        <Row gutter={12}>
          <Col xs={18}>
            <Input
              size="large"
              prefix={<SearchOutlined />}
              placeholder="输入 task_id（来自 /scan/single?async_mode=true）"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value.trim())}
            />
          </Col>
          <Col xs={6}>
            <Button
              type="primary"
              size="large"
              block
              disabled={!taskId}
              onClick={() => setTaskId(taskId)}
            >
              查询
            </Button>
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>任务状态</span>
                {meta && <Tag icon={meta.icon} color={meta.color}>{meta.text}</Tag>}
              </span>
            }
            style={{ height: '100%' }}
          >
            {!task && !error && (
              <Spin tip="等待查询..." style={{ display: 'block', padding: 40 }} />
            )}
            {task && (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="任务 ID">
                  <span className="text-mono">{task.task_id}</span>
                </Descriptions.Item>
                <Descriptions.Item label="类型">{task.kind}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {meta && <Tag icon={meta.icon} color={meta.color}>{meta.text}</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {task.started_at ? new Date(task.started_at).toLocaleString('zh-CN') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {task.completed_at ? new Date(task.completed_at).toLocaleString('zh-CN') : '-'}
                </Descriptions.Item>
                {task.error_message && (
                  <Descriptions.Item label="错误">
                    <span style={{ color: 'var(--danger)' }}>{task.error_message}</span>
                  </Descriptions.Item>
                )}
                {task.output && Object.keys(task.output).length > 0 && (
                  <Descriptions.Item label="输出">
                    <pre className="text-mono" style={{
                      margin: 0,
                      maxHeight: 200,
                      overflow: 'auto',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-normal)',
                    }}>
                      {JSON.stringify(task.output, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <LiveTracePanel scanId={scanId} height={460} />
        </Col>
      </Row>
    </div>
  );
}
