import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  SearchOutlined,
  ExperimentOutlined,
  ApiOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';
import BatchScan from './pages/BatchScan';
import EvalCenter from './pages/EvalCenter';
import McpTools from './pages/McpTools';
import History from './pages/History';
import MlMetrics from './pages/MlMetrics';
import SkillFiles from './pages/SkillFiles';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '风险排行榜' },
  { key: '/scan', icon: <SearchOutlined />, label: '批量扫雷' },
  { key: '/ml', icon: <ThunderboltOutlined />, label: '模型指标' },
  { key: '/eval', icon: <ExperimentOutlined />, label: '评估中心' },
  { key: '/mcp', icon: <ApiOutlined />, label: 'MCP 工具' },
  { key: '/skills', icon: <FileTextOutlined />, label: 'Skill 文件' },
  { key: '/history', icon: <HistoryOutlined />, label: '扫雷历史' },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selected = location.pathname === '/'
    ? '/'
    : location.pathname.startsWith('/company')
      ? '/'
      : '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <Sider
        theme="dark"
        width={210}
        className="app-sider"
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20, overflow: 'auto' }}
      >
        <div className="sidebar-logo">
          <span className="logo-icon"><ThunderboltOutlined /></span>
          <span className="logo-text">扫雷预警</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 'none' }}
        />
        <div className="sider-footer">
          <div>Agentic AI Platform</div>
          <div>v2.0 · Digital Twin</div>
        </div>
      </Sider>

      {/* ── Main Content ── */}
      <Layout style={{ marginLeft: 210 }}>
        {/* ── Header ── */}
        <Header className="app-header">
          <span className="header-title">
            上市公司监管问询概率预测与扫雷预警
          </span>
          <div className="header-right">
            <span className="header-badge">
              <span className="dot" />
              系统运行中
            </span>
            <span className="header-time">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                weekday: 'short',
              })}
            </span>
            <span className="header-time" style={{ fontSize: 14, opacity: 0.8 }}>
              {new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        </Header>

        {/* ── Content ── */}
        <Content className="app-content fade-in">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/company/:code" element={<CompanyDetail />} />
            <Route path="/scan" element={<BatchScan />} />
            <Route path="/eval" element={<EvalCenter />} />
            <Route path="/mcp" element={<McpTools />} />
            <Route path="/history" element={<History />} />
            <Route path="/ml" element={<MlMetrics />} />
            <Route path="/skills" element={<SkillFiles />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}