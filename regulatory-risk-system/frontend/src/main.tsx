import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1a5cff',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBgLayout: '#f0f2f5',
          colorBorder: '#e5e7eb',
          colorBorderSecondary: '#f0f0f0',
          colorText: '#1f2937',
          colorTextSecondary: '#6b7280',
          colorTextTertiary: '#9ca3af',
          colorTextQuaternary: '#d1d5db',
          colorFillSecondary: '#f3f4f6',
          colorFillTertiary: '#f9fafb',
          colorSuccess: '#059669',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          colorInfo: '#1a5cff',
          borderRadius: 10,
          wireframe: false,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#0f1724',
            headerBg: 'rgba(255,255,255,0.92)',
            bodyBg: '#f0f2f5',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: '#1a5cff',
            darkItemSelectedColor: '#ffffff',
            darkItemColor: 'rgba(255,255,255,0.55)',
            darkItemHoverColor: 'rgba(255,255,255,0.85)',
            darkItemHoverBg: 'rgba(255,255,255,0.08)',
          },
          Table: {
            headerBg: '#f9fafb',
            headerColor: '#6b7280',
            rowHoverBg: 'rgba(26,92,255,0.03)',
            borderColor: '#f0f0f0',
          },
          Card: {
            colorBgContainer: '#ffffff',
            colorBorderSecondary: '#e5e7eb',
          },
          Input: {
            colorBgContainer: '#f3f4f6',
            activeBorderColor: '#1a5cff',
          },
          Select: {
            colorBgContainer: '#f3f4f6',
            optionActiveBg: 'rgba(26,92,255,0.06)',
            optionSelectedBg: 'rgba(26,92,255,0.10)',
          },
          Button: {
            primaryShadow: '0 2px 6px rgba(26,92,255,0.20)',
          },
          Progress: {
            remainingColor: 'rgba(0,0,0,0.06)',
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Tabs: {
            inkBarColor: '#1a5cff',
            itemActiveColor: '#1a5cff',
            itemSelectedColor: '#1a5cff',
            itemHoverColor: '#1f2937',
          },
          Timeline: {
            dotBg: '#ffffff',
          },
          Collapse: {
            headerBg: '#ffffff',
            contentBg: '#fafbfc',
          },
          Alert: {
            colorInfoBg: 'rgba(26,92,255,0.04)',
            colorInfoBorder: 'rgba(26,92,255,0.12)',
          },
          Modal: {
            contentBg: '#ffffff',
            headerBg: '#ffffff',
          },
          Dropdown: {
            colorBgElevated: '#ffffff',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);