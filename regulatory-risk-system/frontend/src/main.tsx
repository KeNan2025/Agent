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
          colorPrimary: '#4f8ff7',
          colorBgContainer: '#1e293b',
          colorBgElevated: '#253349',
          colorBgLayout: '#111827',
          colorBorder: 'rgba(148,163,184,0.10)',
          colorBorderSecondary: 'rgba(148,163,184,0.06)',
          colorText: '#f8fafc',
          colorTextSecondary: '#a8b7cc',
          colorTextTertiary: '#7a8ba3',
          colorTextQuaternary: '#5a6b82',
          colorFillSecondary: 'rgba(79,143,247,0.06)',
          colorFillTertiary: 'rgba(79,143,247,0.04)',
          colorSuccess: '#34d399',
          colorWarning: '#fbbf24',
          colorError: '#f87171',
          colorInfo: '#4f8ff7',
          borderRadius: 10,
          wireframe: false,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#0f172a',
            headerBg: 'rgba(17,24,39,0.82)',
            bodyBg: '#111827',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: '#2563eb',
            darkItemSelectedColor: '#ffffff',
            darkItemColor: '#a8b7cc',
            darkItemHoverColor: '#f8fafc',
            darkItemHoverBg: 'rgba(79,143,247,0.08)',
          },
          Table: {
            headerBg: 'rgba(79,143,247,0.04)',
            headerColor: '#a8b7cc',
            rowHoverBg: 'rgba(79,143,247,0.04)',
            borderColor: 'rgba(148,163,184,0.06)',
          },
          Card: {
            colorBgContainer: '#1e293b',
            colorBorderSecondary: 'rgba(148,163,184,0.10)',
          },
          Input: {
            colorBgContainer: '#162032',
            activeBorderColor: '#4f8ff7',
          },
          Select: {
            colorBgContainer: '#162032',
            optionActiveBg: 'rgba(79,143,247,0.08)',
            optionSelectedBg: 'rgba(79,143,247,0.14)',
          },
          Button: {
            primaryShadow: '0 2px 8px rgba(79,143,247,0.28)',
          },
          Progress: {
            remainingColor: 'rgba(148,163,184,0.08)',
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Tabs: {
            inkBarColor: '#4f8ff7',
            itemActiveColor: '#4f8ff7',
            itemSelectedColor: '#4f8ff7',
            itemHoverColor: '#f8fafc',
          },
          Timeline: {
            dotBg: '#1e293b',
          },
          Collapse: {
            headerBg: '#1e293b',
            contentBg: '#1a2236',
          },
          Alert: {
            colorInfoBg: 'rgba(79,143,247,0.06)',
            colorInfoBorder: 'rgba(79,143,247,0.14)',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
