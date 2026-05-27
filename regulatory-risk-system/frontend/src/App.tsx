import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu, Typography, Breadcrumb } from 'antd';
import {
  DashboardOutlined,
  SearchOutlined,
  ExperimentOutlined,
  ApiOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';
import BatchScan from './pages/BatchScan';
import EvalCenter from './pages/EvalCenter';
import McpTools from './pages/McpTools';
import History from './pages/History';
import MlMetrics from './pages/MlMetrics';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '风险排行榜' },
  { key: '/scan', icon: <SearchOutlined />, label: '批量扫雷' },
  { key: '/ml', icon: <ThunderboltOutlined />, label: '模型指标' },
  { key: '/eval', icon: <ExperimentOutlined />, label: '评估中心' },
  { key: '/mcp', icon: <ApiOutlined />, label: 'MCP 工具' },
  { key: '/history', icon: <HistoryOutlined />, label: '扫雷历史' },
];

const pageTitles: Record<string, string> = {
  '/': '风险排行榜',
  '/scan': '批量扫雷',
  '/ml': '模型指标',
  '/eval': '评估中心',
  '/mcp': 'MCP 工具',
  '/history': '扫雷历史',
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selected = location.pathname === '/'
    ? '/'
    : location.pathname.startsWith('/company')
      ? '/'
      : '/' + location.pathname.split('/')[1];

  const currentTitle = location.pathname.startsWith('/company')
    ? '公司详情'
    : pageTitles[selected] || '';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        width={220}
        className="app-sider"
        style={{
          background: 'linear-gradient(180deg, #001529 0%, #002140 100%)',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">
            <SafetyCertificateOutlined />
          </div>
          <span className="logo-text">扫雷预警系统</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 'none' }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
            Agentic AI Platform
          </Typography.Text>
          <br />
          <Typography.Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
            v1.0.0
          </Typography.Text>
        </div>
      </Sider>
      <Layout style={{ marginLeft: 220 }}>
        <Header className="app-header" style={{ height: 56, lineHeight: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Breadcrumb
              items={[
                { title: '首页' },
                ...(currentTitle ? [{ title: currentTitle }] : []),
              ]}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="header-right">
            <div className="header-badge">
              <span className="dot" />
              系统运行中
            </div>
            <Typography.Text style={{ fontSize: 13, color: '#8c8c8c' }}>
              Agentic AI
            </Typography.Text>
          </div>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/company/:code" element={<CompanyDetail />} />
            <Route path="/scan" element={<BatchScan />} />
            <Route path="/eval" element={<EvalCenter />} />
            <Route path="/mcp" element={<McpTools />} />
            <Route path="/history" element={<History />} />
            <Route path="/ml" element={<MlMetrics />} />
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
