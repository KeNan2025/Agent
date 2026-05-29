import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Input, Upload, Space, Tag, Row, Col,
  Statistic, Spin, message, Tooltip, Empty, Select,
} from 'antd';
import {
  FileTextOutlined, UploadOutlined, DownloadOutlined, EditOutlined,
  EyeOutlined, DeleteOutlined, CodeOutlined, FolderOpenOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import {
  listSkillFiles, getSkillFile, getSkillFileDownloadUrl,
  uploadSkillFile, updateSkillFile, deleteSkillFile,
} from '../api/client';

const { Dragger } = Upload;
const { TextArea } = Input;

interface SkillFile {
  id: number;
  filename: string;
  description: string;
  skill_name: string;
  size: number;
  updated_at: string;
  content?: string;
}

export default function SkillFiles() {
  const [files, setFiles] = useState<SkillFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSkillName, setUploadSkillName] = useState<string | undefined>(undefined);
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewContent, setViewContent] = useState('');
  const [viewFilename, setViewFilename] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFilename, setEditFilename] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await listSkillFiles();
      setFiles(Array.isArray(data) ? data : data.files ?? []);
    } catch (e: any) {
      message.error('获取文件列表失败: ' + (e?.message ?? e));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // --- Stats ---
  const totalFiles = files.length;
  const skillNames = [...new Set(files.map((f) => f.skill_name).filter(Boolean))];
  const skillDist = skillNames.map((name) => ({
    name,
    count: files.filter((f) => f.skill_name === name).length,
  }));

  // --- Helpers ---
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // --- View ---
  const handleView = async (record: SkillFile) => {
    try {
      const data = await getSkillFile(record.id);
      setViewFilename(record.filename);
      setViewContent(data.content ?? data.content ?? '（无内容）');
      setViewOpen(true);
    } catch (e: any) {
      message.error('获取文件内容失败: ' + (e?.message ?? e));
    }
  };

  // --- Edit ---
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

  // --- Download ---
  const handleDownload = (record: SkillFile) => {
    const url = getSkillFileDownloadUrl(record.id);
    window.open(url, '_blank');
  };

  // --- Delete ---
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

  // --- Upload ---
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

  // --- Columns ---
  const columns = [
    {
      title: '文件名', dataIndex: 'filename', width: 220,
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: 'var(--text-2)' }} />
          <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: '描述', dataIndex: 'description', width: 220,
      render: (v: string) => (
        <span style={{ color: 'var(--text-2)' }}>
          {v || <span style={{ color: 'var(--text-3)' }}>-</span>}
        </span>
      ),
    },
    {
      title: '所属 Skill', dataIndex: 'skill_name', width: 140,
      render: (v: string) =>
        v ? (
          <Tag color="cyan" style={{ borderRadius: 4, margin: 0 }}>{v}</Tag>
        ) : (
          <span style={{ color: 'var(--text-3)' }}>-</span>
        ),
    },
    {
      title: '大小', dataIndex: 'size', width: 100,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>
          {formatSize(v)}
        </span>
      ),
    },
    {
      title: '最后更新', dataIndex: 'updated_at', width: 160,
      render: (v: string) => (
        <span style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
          {formatDate(v)}
        </span>
      ),
    },
    {
      title: '操作', key: 'action', width: 220,
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
            <Button type="primary" size="small" icon={<DownloadOutlined />}
                    onClick={() => handleDownload(r)} ghost>下载</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="default" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => handleDelete(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-container fade-in">
        <div className="page-title">
          <span className="title-bar" />
          <span>Skill 文件管理</span>
        </div>

        {/* Stat row */}
        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-purple" bodyStyle={{ padding: '20px 24px' }}>
              <FolderOpenOutlined className="stat-icon" />
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>文件总数</span>}
                value={totalFiles}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-cyan" bodyStyle={{ padding: '20px 24px' }}>
              <CodeOutlined className="stat-icon" />
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>Skill 种类</span>}
                value={skillNames.length}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#06b6d4' }}
              />
            </Card>
          </Col>
          {skillDist.slice(0, 2).map((s, i) => (
            <Col xs={12} sm={6} key={s.name}>
              <Card className={`stat-card ${i === 0 ? 'stat-geekblue' : 'stat-volcano'}`}
                    bodyStyle={{ padding: '20px 24px' }}>
                <FileTextOutlined className="stat-icon" />
                <Statistic
                  title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>{s.name}</span>}
                  value={s.count}
                  valueStyle={{ fontSize: 28, fontWeight: 700, color: i === 0 ? '#2f54eb' : '#fa541c' }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<UploadOutlined />}
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
                <span style={{ color: 'var(--text-2)' }}>
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

        {/* Upload Modal */}
        <Modal
          title={
            <Space>
              <CloudUploadOutlined style={{ color: '#4f8ff7' }} />
              <span>上传 Skill 文件</span>
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
          width={500}
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
              <Button type="primary" loading={uploading} onClick={handleUpload}
                      icon={<UploadOutlined />}>
                上传
              </Button>
            </Space>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <Dragger
              accept="*"
              beforeUpload={(file) => {
                setUploadFile(file);
                return false;
              }}
              onRemove={() => setUploadFile(null)}
              showUploadList={true}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text" style={{ color: 'var(--text-1)' }}>
                点击或拖拽文件到此区域上传
              </p>
              <p className="ant-upload-hint" style={{ color: 'var(--text-3)' }}>
                支持任意文件类型，单个文件上传
              </p>
            </Dragger>

            <div style={{ marginTop: 16 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>
                Skill 名称（可选）
              </span>
              <Select
                allowClear
                showSearch
                placeholder="选择或输入 Skill 名称"
                value={uploadSkillName}
                onChange={(v) => setUploadSkillName(v)}
                style={{ width: '100%' }}
                filterOption={(input, option) =>
                  (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={skillNames.map((n) => ({ value: n, label: n }))}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>
                文件描述
              </span>
              <TextArea
                rows={3}
                placeholder="输入文件描述信息..."
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                style={{ background: 'var(--bg-input)', color: 'var(--text-1)', borderColor: 'var(--border)', borderRadius: 8 }}
              />
            </div>
          </div>
        </Modal>

        {/* View Modal */}
        <Modal
          title={
            <Space>
              <EyeOutlined style={{ color: '#4f8ff7' }} />
              <span>查看文件 — </span>
              <Tag color="purple" style={{ borderRadius: 4 }}>{viewFilename}</Tag>
            </Space>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={700}
          footer={
            <Button type="default" onClick={() => setViewOpen(false)}>关闭</Button>
          }
        >
          <pre className="text-mono"
               style={{
                 background: 'var(--bg-input)',
                 padding: 16,
                 borderRadius: 8,
                 maxHeight: 400,
                 overflow: 'auto',
                 fontSize: 13,
                 color: 'var(--text-1)',
                 border: '1px solid var(--border)',
                 lineHeight: 1.6,
                 margin: 0,
               }}>
            {viewContent}
          </pre>
        </Modal>

        {/* Edit Modal */}
        <Modal
          title={
            <Space>
              <EditOutlined style={{ color: '#4f8ff7' }} />
              <span>编辑文件 — </span>
              <Tag color="purple" style={{ borderRadius: 4 }}>{editFilename}</Tag>
            </Space>
          }
          open={editOpen}
          onCancel={() => {
            if (!saving) setEditOpen(false);
          }}
          width={700}
          footer={
            <Space>
              <Button onClick={() => setEditOpen(false)} disabled={saving}>取消</Button>
              <Button type="primary" loading={saving} onClick={handleEditSave}
                      icon={<EditOutlined />}>
                保存
              </Button>
            </Space>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>
                文件描述
              </span>
              <Input
                placeholder="输入文件描述..."
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                style={{ background: 'var(--bg-input)', color: 'var(--text-1)', borderColor: 'var(--border)', borderRadius: 8 }}
              />
            </div>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>
              文件内容
            </span>
            <TextArea
              rows={16}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-1)',
                borderColor: 'var(--border)',
                borderRadius: 8,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            />
          </div>
        </Modal>
      </div>
    </Spin>
  );
}