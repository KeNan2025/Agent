import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  AimOutlined, HeatMapOutlined, NodeIndexOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import CompanyTwin from './pages/CompanyTwin';
import MarketHeatmap from './pages/MarketHeatmap';
import PipelineTwin from './pages/PipelineTwin';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/company', icon: <AimOutlined />, label: '公司风险孪生' },
  { key: '/market', icon: <HeatMapOutlined />, label: '市场风险热力图' },
  { key: '/pipeline', icon: <NodeIndexOutlined />, label: 'Pipeline 运行孪生' },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selected = '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200} className="app-sider" style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20, overflow: 'auto' }}>
        <div className="sidebar-logo">
          <span className="logo-icon"><NodeIndexOutlined /></span>
          <span className="logo-text">数字孪生</span>
        </div>
        <Menu
          theme="dark" mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 'none', marginTop: 6 }}
        />
        <div className="sider-footer">
          <span style={{ opacity: .5, fontSize: 11 }}>DIGITAL TWIN · v1.0</span>
        </div>
      </Sider>
      <Layout style={{ marginLeft: 200 }}>
        <Header className="app-header">
          <span className="header-title">上市公司扫雷数字孪生可视化平台</span>
          <div className="header-right">
            <span className="header-badge"><span className="dot" />实时监控中</span>
            <span className="header-time">2026-05-29</span>
          </div>
        </Header>
        <Content className="app-content fade-in">
          <Routes>
            <Route path="/company" element={<CompanyTwin />} />
            <Route path="/market" element={<MarketHeatmap />} />
            <Route path="/pipeline" element={<PipelineTwin />} />
            <Route path="*" element={<Navigate to="/company" replace />} />
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