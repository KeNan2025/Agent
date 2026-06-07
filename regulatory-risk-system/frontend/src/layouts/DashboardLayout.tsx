import { Layout, Menu, Dropdown, Avatar, Tag } from 'antd';
import {
  DashboardOutlined,
  SearchOutlined,
  ExperimentOutlined,
  ApiOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  RocketOutlined,
  BookOutlined,
  ProjectOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useClock } from '../hooks/useClock';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { useAuth } from '../store/auth';
import { healthz } from '../api/client';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '风险排行榜' },
  { key: '/scan', icon: <SearchOutlined />, label: '批量扫雷' },
  { key: '/ml', icon: <ThunderboltOutlined />, label: '模型指标' },
  { key: '/backtest', icon: <RocketOutlined />, label: '赛题回测' },
  { key: '/regulation-focus', icon: <BookOutlined />, label: '关注点词表' },
  { key: '/eval', icon: <ExperimentOutlined />, label: '评估中心' },
  { key: '/mcp', icon: <ApiOutlined />, label: 'MCP 工具' },
  { key: '/skills', icon: <FileTextOutlined />, label: 'Skill 文件' },
  { key: '/tasks', icon: <ProjectOutlined />, label: '异步任务' },
  { key: '/history', icon: <HistoryOutlined />, label: '扫雷历史' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { dateStr, timeStr } = useClock();
  const { logout } = useAuth();
  const [health, setHealth] = useState<{ llm_mode: string; data_mode: string } | null>(null);

  useEffect(() => {
    healthz().then(setHealth).catch(() => setHealth(null));
  }, []);

  const selected = location.pathname === '/'
    ? '/'
    : location.pathname.startsWith('/company')
      ? '/'
      : '/' + location.pathname.split('/')[1];

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <Sider
        theme="dark"
        width={240}
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
          <ThemeSwitcher />
          <div className="version-text">
            <div>Agentic AI Platform</div>
            <div>v2.0 · Digital Twin</div>
          </div>
        </div>
      </Sider>

      {/* ── Main Content ── */}
      <Layout style={{ marginLeft: 240 }}>
        {/* ── Header ── */}
        <Header className="app-header">
          <span className="header-title">
            上市公司监管问询概率预测与扫雷预警
          </span>
          <div className="header-right">
            {health && (
              <>
                <Tag color={health.llm_mode === 'real' ? 'green' : 'default'}>
                  LLM: {health.llm_mode}
                </Tag>
                <Tag color={health.data_mode === 'local' ? 'blue' : 'default'}>
                  数据: {health.data_mode}
                </Tag>
              </>
            )}
            <span className="header-badge">
              <span className="dot" />
              系统运行中
            </span>
            <span className="header-time">{dateStr}</span>
            <span className="header-time" style={{ fontSize: 14, opacity: 0.8 }}>{timeStr}</span>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Avatar
                style={{ background: 'var(--primary-gradient)', cursor: 'pointer' }}
                icon={<UserOutlined />}
              />
            </Dropdown>
          </div>
        </Header>

        {/* ── Content ── */}
        <Content className="app-content fade-in">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
