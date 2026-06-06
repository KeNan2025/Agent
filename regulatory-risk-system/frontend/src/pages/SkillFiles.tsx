import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Input, Upload, Space, Tag, Row, Col,
  Spin, message, Tooltip, Empty, Select, Descriptions, Divider
} from 'antd';
import {
  FileTextOutlined, UploadOutlined, DownloadOutlined, EditOutlined,
  EyeOutlined, DeleteOutlined, CodeOutlined, FolderOpenOutlined,
  CloudUploadOutlined, ApiOutlined, ToolOutlined, PlusOutlined
} from '@ant-design/icons';
import {
  listSkillFiles, getSkillFile, getSkillFileDownloadUrl,
  uploadSkillFile, updateSkillFile, deleteSkillFile, mcpListTools
} from '../api/client';
import type { SkillFile, McpTool } from '../types';
import { formatSize, formatDate } from '../utils/format';
import StatCard from '../components/StatCard';
import PageTitle from '../components/PageTitle';

const { Dragger } = Upload;
const { TextArea } = Input;

export default function SkillFiles() {
  // ── System skills state ──
  const [systemSkills, setSystemSkills] = useState<McpTool[]>([]);
  const [skillsRefreshing, setSkillsRefreshing] = useState(false);

  // ── Files state ──
  const [files, setFiles] = useState<SkillFile[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Upload state ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSkillName, setUploadSkillName] = useState<string | undefined>(undefined);
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<SkillFile | null>(null);
  const [viewContent, setViewContent] = useState('');
  const [viewFilename, setViewFilename] = useState('');

  // ── Edit state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFilename, setEditFilename] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Fetch files ──
  const fetchFiles = async () => {
    try {
      const data = await listSkillFiles();
      const raw = Array.isArray(data) ? data : data.files ?? [];
      setFiles(raw.map((f: any) => ({ ...f, size: f.size_bytes ?? f.size ?? 0 })));
    } catch (e: any) {
      message.error('获取文件列表失败: ' + (e?.message ?? e));
    }
  };

  // ── Fetch system skills ──
  const fetchSkills = async (showMessage = false) => {
    try {
      const data = await mcpListTools();
      setSystemSkills(data.tools ?? []);
      if (showMessage) message.success('Skill 列表已刷新');
    } catch (e: any) {
      if (showMessage) message.error('刷新失败: ' + (e?.message ?? e));
    }
  };

  useEffect(() => {
    Promise.all([
      fetchFiles(),
      fetchSkills(),
    ]).finally(() => setLoading(false));
  }, []);

  const handleRefreshSkills = async () => {
    setSkillsRefreshing(true);
    await fetchSkills(true);
    setSkillsRefreshing(false);
  };

  // ── Stats ──
  const totalFiles = files.length;
  const fileSkillNames = [...new Set(files.map((f) => f.skill_name).filter(Boolean))];
  const recentUpdated = files.filter((f) => {
    if (!f.updated_at) return false;
    const d = new Date(f.updated_at).getTime();
    return (Date.now() - d) < 24 * 60 * 60 * 1000;
  }).length;
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

  // ── View ──
  const handleView = async (record: SkillFile) => {
    try {
      const data = await getSkillFile(record.id);
      setViewRecord(record);
      setViewFilename(record.filename);
      setViewContent(data.content ?? '（无内容）');
      setViewOpen(true);
    } catch (e: any) {
      message.error('获取文件内容失败: ' + (e?.message ?? e));
    }
  };

  // ── Edit ──
  const handleEditOpen = async (record: SkillFile) => {
    try {
      const data = await getSkillFile(record.id);
      setEditId(record.id);
      setEditFilename(record.filename);
      setEditContent(data.content ?? '');
      setEditDesc(record.description || '');
      setEditOpen(true);
    } catch (e: any) {
      message.error('获取文件内容失败: ' + (e?.message ?? e));
    }
  };

  const handleEditSave = async () => {
    if (editId === null) return;
    setSaving(true);
    try {
      await updateSkillFile(editId, editContent, editDesc);
      message.success('文件已更新');
      setEditOpen(false);
      fetchFiles();
    } catch (e: any) {
      message.error('更新失败: ' + (e?.message ?? e));
    }
    setSaving(false);
  };

  // ── Download ──
  const handleDownload = (record: SkillFile) => {
    window.open(getSkillFileDownloadUrl(record.id), '_blank');
  };

  // ── Delete ──
  const handleDelete = (record: SkillFile) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件 "${record.filename}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteSkillFile(record.id);
          message.success('文件已删除');
          fetchFiles();
        } catch (e: any) {
          message.error('删除失败: ' + (e?.message ?? e));
        }
      },
    });
  };

  // ── Upload ──
  const handleUpload = async () => {
    if (!uploadFile) {
      message.warning('请先选择文件');
      return;
    }
    setUploading(true);
    try {
      await uploadSkillFile(uploadFile, uploadSkillName, uploadDesc);
      message.success('上传成功');
      setUploadOpen(false);
      setUploadFile(null);
      setUploadSkillName(undefined);
      setUploadDesc('');
      fetchFiles();
    } catch (e: any) {
      message.error('上传失败: ' + (e?.message ?? e));
    }
    setUploading(false);
  };

  // ── Render input schema summary for tooltip ──
  const renderSchemaTooltip = (skill: McpTool) => {
    const schema = skill.inputSchema;
    if (!schema || !schema.properties) return <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>无参数</span>;

    const props = schema.properties;
    const required = schema.required ?? [];
    const keys = Object.keys(props);

    const content = (
      <div style={{ maxWidth: 360, fontSize: 12, lineHeight: 1.8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#fff' }}>输入参数 ({keys.length})</div>
        {keys.map((k) => {
          const p = props[k];
          const isReq = required.includes(k);
          return (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ color: 'var(--text-normal)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{k}</span>
              <span style={{ color: 'var(--text-normal)', fontSize: 11 }}>{p.type ?? 'any'}</span>
              {isReq && <Tag color="red" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>必填</Tag>}
            </div>
          );
        })}
      </div>
    );

    return (
      <Tooltip title={content} overlayStyle={{ borderRadius: 8 }}>
        <span style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
          查看详情
        </span>
      </Tooltip>
    );
  };

  // ── Table columns ──
  const columns = [
    {
      title: '文件名', dataIndex: 'filename', width: 220,
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: 'var(--text-normal)' }} />
          <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: '描述', dataIndex: 'description', width: 220,
      render: (v: string) => (
        <span style={{ color: 'var(--text-normal)' }}>
          {v || <span style={{ color: 'var(--text-dim)' }}>-</span>}
        </span>
      ),
    },
    {
      title: '所属 Skill', dataIndex: 'skill_name', width: 140,
      render: (v: string) =>
        v ? (
          <Tag color="blue" style={{ margin: 0 }}>{v}</Tag>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>-</span>
        ),
    },
    {
      title: '大小', dataIndex: 'size', width: 100,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-bright)' }}>
          {formatSize(v)}
        </span>
      ),
    },
    {
      title: '最后更新', dataIndex: 'updated_at', width: 160,
      render: (v: string) => (
        <span style={{ color: 'var(--text-normal)', fontVariantNumeric: 'tabular-nums' }}>
          {formatDate(v)}
        </span>
      ),
    },
    {
      title: '操作', key: 'action', width: 240,
      render: (_: any, r: SkillFile) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button type="default" size="small" icon={<EyeOutlined />}
                    onClick={() => handleView(r)}>查看</Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="default" size="small" icon={<EditOutlined />}
                    onClick={() => handleEditOpen(r)}>编辑</Button>
          </Tooltip>
          <Tooltip title="下载">
            <Button type="primary" className="btn-ghost-primary" size="small" icon={<DownloadOutlined />}
                    onClick={() => handleDownload(r)} ghost>下载</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="default" className="btn-danger" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => handleDelete(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-container fade-in">
        <PageTitle title="Skill 管理体系" />

        {/* ── System Skills Section ── */}
        <Card
          style={{ marginBottom: 24 }}
          title={
            <Space>
              <ApiOutlined style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 600 }}>系统已注册 Skill</span>
            </Space>
          }
          extra={
            <Button
              size="small"
              className="btn-purple"
              icon={<CodeOutlined />}
              loading={skillsRefreshing}
              onClick={handleRefreshSkills}
            >
              刷新
            </Button>
          }
        >
          {systemSkills.length === 0 && !skillsRefreshing ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: 'var(--text-normal)' }}>
                  暂无已注册的系统 Skill，请先通过 MCP 接口注册
                </span>
              }
            />
          ) : (
            <Row gutter={[16, 16]}>
              {systemSkills.map((skill) => {
                const propCount = skill.inputSchema?.properties
                  ? Object.keys(skill.inputSchema.properties).length
                  : 0;
                return (
                  <Col xs={24} sm={12} lg={8} key={skill.name}>
                    <Card
                      size="small"
                      className="fade-in-up"
                      style={{ height: '100%' }}
                      styles={{ body: { padding: '16px 18px' } }}
                    >
                      <Space style={{ marginBottom: 10 }}>
                        <ApiOutlined style={{ color: 'var(--primary)', fontSize: 16 }} />
                        <Tag color="blue" style={{ fontWeight: 600 }}>
                          {skill.name}
                        </Tag>
                      </Space>
                      <p style={{
                        color: 'var(--text-normal)', fontSize: 13, lineHeight: 1.6,
                        margin: 0, marginBottom: 12, minHeight: 40,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {skill.description || '暂无描述信息'}
                      </p>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', borderTop: '1px solid var(--divider)',
                        paddingTop: 10,
                      }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                          {propCount > 0 ? <>{propCount} 个输入参数</> : <>无参数</>}
                        </span>
                        {renderSchemaTooltip(skill)}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Card>

        <Divider style={{ margin: '0 0 24px 0', color: 'var(--text-dim)', fontSize: 12 }}>
          <ToolOutlined style={{ marginRight: 6 }} />
          文件管理
        </Divider>

        {/* ── Stat row ── */}
        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <StatCard title="文件总数" value={totalFiles} color="blue" icon={<FolderOpenOutlined />} />
          </Col>
          <Col xs={12} sm={6}>
            <StatCard title="Skill 类型" value={fileSkillNames.length} color="purple" icon={<ToolOutlined />} />
          </Col>
          <Col xs={12} sm={6}>
            <StatCard title="24h 更新" value={recentUpdated} color="cyan" icon={<FileTextOutlined />} />
          </Col>
          <Col xs={12} sm={6}>
            <StatCard title="总大小" value={formatSize(totalSize)} color="green" icon={<CodeOutlined />} />
          </Col>
        </Row>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" className="btn-success" icon={<PlusOutlined />}
                  onClick={() => setUploadOpen(true)}>
            上传文件
          </Button>
        </div>

        {/* Table */}
        <Card>
          {files.length === 0 && !loading ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: 'var(--text-normal)' }}>
                  暂无 Skill 文件，点击右上角「上传文件」添加
                </span>
              }
            />
          ) : (
            <Table
              size="middle"
              rowKey="id"
              columns={columns}
              dataSource={files}
              pagination={{ pageSize: 15, showSizeChanger: false }}
            />
          )}
        </Card>

        {/* ── Upload Modal ── */}
        <Modal
          title={
            <Space>
              <CloudUploadOutlined style={{ color: 'var(--primary)' }} />
              <span>上传文件到 Skill 系统</span>
            </Space>
          }
          open={uploadOpen}
          onCancel={() => {
            if (!uploading) {
              setUploadOpen(false);
              setUploadFile(null);
              setUploadSkillName(undefined);
              setUploadDesc('');
            }
          }}
          width={540}
          footer={
            <Space>
              <Button onClick={() => {
                setUploadOpen(false);
                setUploadFile(null);
                setUploadSkillName(undefined);
                setUploadDesc('');
              }} disabled={uploading}>
                取消
              </Button>
              <Button type="primary" className="btn-success" loading={uploading} onClick={handleUpload}
                      icon={<UploadOutlined />}>
                上传
              </Button>
            </Space>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <Dragger
              accept="*"
              beforeUpload={(file) => { setUploadFile(file); return false; }}
              onRemove={() => setUploadFile(null)}
              showUploadList={true}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text" style={{ color: 'var(--text-bright)' }}>
                点击或拖拽文件到此区域上传
              </p>
              <p className="ant-upload-hint" style={{ color: 'var(--text-dim)' }}>
                选择需要上传到 Skill 系统的文件，支持脚本、配置、数据文件等
              </p>
            </Dragger>

            <div style={{ marginTop: 16 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-bright)', marginBottom: 6 }}>
                关联 Skill 名称
              </span>
              <Select
                allowClear
                showSearch
                placeholder="从系统已注册 Skill 中选择或输入"
                value={uploadSkillName}
                onChange={(v) => setUploadSkillName(v)}
                style={{ width: '100%' }}
                filterOption={(input, option) =>
                  ((option?.value as string) ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={systemSkills.map((s) => ({ value: s.name, label: s.name }))}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-bright)', marginBottom: 6 }}>
                文件用途说明
              </span>
              <TextArea
                rows={3}
                placeholder="请输入文件用途说明..."
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
              />
            </div>
          </div>
        </Modal>

        {/* ── View Modal ── */}
        <Modal
          title={
            <Space>
              <EyeOutlined style={{ color: 'var(--primary)' }} />
              <span>查看文件 — </span>
              <Tag color="blue">{viewRecord?.filename ?? viewFilename}</Tag>
            </Space>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={720}
          footer={
            <Button type="default" onClick={() => setViewOpen(false)}>关闭</Button>
          }
        >
          {viewRecord && (
            <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文件名" span={2}>
                <Space>
                  <FileTextOutlined style={{ color: 'var(--text-normal)' }} />
                  <span style={{ fontWeight: 500, color: 'var(--text-bright)' }}>{viewRecord.filename}</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="大小">
                <span style={{ color: 'var(--text-bright)' }}>{formatSize(viewRecord.size)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="所属 Skill">
                {viewRecord.skill_name
                  ? <Tag color="blue" style={{ margin: 0 }}>{viewRecord.skill_name}</Tag>
                  : <span style={{ color: 'var(--text-dim)' }}>-</span>}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                <span style={{ color: 'var(--text-normal)' }}>
                  {viewRecord.description || <span style={{ color: 'var(--text-dim)' }}>无描述</span>}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="最后更新" span={2}>
                <span style={{ color: 'var(--text-normal)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDate(viewRecord.updated_at)}
                </span>
              </Descriptions.Item>
            </Descriptions>
          )}
          <div style={{
            background: 'var(--muted-bg)',
            border: '1px solid var(--border-panel)',
            borderRadius: 8,
            padding: 16,
            maxHeight: 400,
            overflow: 'auto',
          }}>
            <pre className="text-mono" style={{
              fontSize: 13, color: 'var(--text-bright)', lineHeight: 1.6,
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {viewContent}
            </pre>
          </div>
        </Modal>

        {/* ── Edit Modal ── */}
        <Modal
          title={
            <Space>
              <EditOutlined style={{ color: 'var(--primary)' }} />
              <span>编辑文件 — </span>
              <Tag color="blue">{editFilename}</Tag>
            </Space>
          }
          open={editOpen}
          onCancel={() => { if (!saving) setEditOpen(false); }}
          width={720}
          footer={
            <Space>
              <Button onClick={() => setEditOpen(false)} disabled={saving}>取消</Button>
              <Button type="primary" className="btn-success" loading={saving} onClick={handleEditSave}
                      icon={<EditOutlined />}>
                保存
              </Button>
            </Space>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-bright)', marginBottom: 6 }}>
                文件描述
              </span>
              <Input
                placeholder="输入文件描述..."
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-bright)', marginBottom: 6 }}>
              文件内容
            </span>
            <div style={{
              background: 'var(--muted-bg)',
              border: '1px solid var(--border-panel)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <TextArea
                rows={16}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{
                  background: 'transparent',
                  color: 'var(--text-bright)',
                  border: 'none',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    </Spin>
  );
}
