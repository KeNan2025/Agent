import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.css';

const { darkAlgorithm } = theme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: '#131a33',
          colorBgElevated: '#1a2240',
          colorBgLayout: '#0a0f1e',
          colorBorder: 'rgba(148,163,184,0.07)',
          colorBorderSecondary: 'rgba(148,163,184,0.05)',
          colorText: '#f1f5f9',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          colorTextQuaternary: '#475569',
          colorFillSecondary: 'rgba(59,130,246,0.06)',
          colorFillTertiary: 'rgba(59,130,246,0.04)',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#3b82f6',
          borderRadius: 10,
          wireframe: false,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#060a16',
            headerBg: 'rgba(10,15,30,0.85)',
            bodyBg: '#0a0f1e',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: '#1e40af',
            darkItemSelectedColor: '#ffffff',
            darkItemColor: '#94a3b8',
            darkItemHoverColor: '#f1f5f9',
            darkItemHoverBg: 'rgba(59,130,246,0.08)',
          },
          Table: {
            headerBg: 'rgba(59,130,246,0.04)',
            headerColor: '#94a3b8',
            rowHoverBg: 'rgba(59,130,246,0.04)',
            borderColor: 'rgba(148,163,184,0.05)',
          },
          Card: {
            colorBgContainer: '#131a33',
            colorBorderSecondary: 'rgba(148,163,184,0.07)',
          },
          Input: {
            colorBgContainer: '#0e1326',
            activeBorderColor: '#3b82f6',
          },
          Select: {
            colorBgContainer: '#0e1326',
            optionActiveBg: 'rgba(59,130,246,0.08)',
            optionSelectedBg: 'rgba(59,130,246,0.15)',
          },
          Button: {
            primaryShadow: '0 2px 8px rgba(59,130,246,0.3)',
          },
          Progress: {
            remainingColor: 'rgba(148,163,184,0.08)',
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Tabs: {
            inkBarColor: '#3b82f6',
            itemActiveColor: '#3b82f6',
            itemSelectedColor: '#3b82f6',
            itemHoverColor: '#f1f5f9',
          },
          Timeline: {
            dotBg: '#131a33',
          },
          Collapse: {
            headerBg: '#131a33',
            contentBg: '#111830',
          },
          Alert: {
            colorInfoBg: 'rgba(59,130,246,0.06)',
            colorInfoBorder: 'rgba(59,130,246,0.12)',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
