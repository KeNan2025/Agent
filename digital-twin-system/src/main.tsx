import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00d4ff',
          colorBgContainer: 'rgba(6, 20, 46, 0.85)',
          colorBgElevated: '#061230',
          colorBgLayout: '#020a1a',
          colorBorder: 'rgba(0, 212, 255, 0.12)',
          colorBorderSecondary: 'rgba(0, 212, 255, 0.08)',
          colorText: '#e8f4ff',
          colorTextSecondary: '#a0c4e8',
          colorTextTertiary: '#5a7fa0',
          colorSuccess: '#00ff88',
          colorWarning: '#ffbe0b',
          colorError: '#ff4757',
          colorInfo: '#00d4ff',
          borderRadius: 6,
          fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#0a1628',
            headerBg: 'rgba(4, 14, 36, 0.92)',
            bodyBg: '#020a1a',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(0, 212, 255, 0.12)',
            darkItemSelectedColor: '#00d4ff',
            darkItemColor: 'rgba(255, 255, 255, 0.55)',
            darkItemHoverColor: 'rgba(255, 255, 255, 0.85)',
            darkItemHoverBg: 'rgba(0, 212, 255, 0.08)',
          },
          Card: {
            colorBgContainer: 'rgba(6, 20, 46, 0.85)',
            colorBorderSecondary: 'rgba(0, 212, 255, 0.12)',
          },
          Table: {
            headerBg: 'rgba(0, 212, 255, 0.03)',
            headerColor: '#5a7fa0',
            rowHoverBg: 'rgba(0, 212, 255, 0.04)',
            borderColor: 'rgba(0, 212, 255, 0.08)',
          },
          Input: {
            colorBgContainer: 'rgba(0, 212, 255, 0.06)',
            activeBorderColor: '#00d4ff',
          },
          Select: {
            colorBgContainer: 'rgba(0, 212, 255, 0.06)',
            optionActiveBg: 'rgba(0, 212, 255, 0.08)',
            optionSelectedBg: 'rgba(0, 212, 255, 0.15)',
          },
          Button: {
            primaryShadow: '0 0 12px rgba(0, 212, 255, 0.3)',
          },
          Tabs: {
            inkBarColor: '#00d4ff',
            itemActiveColor: '#00d4ff',
            itemHoverColor: '#e8f4ff',
          },
          Modal: {
            contentBg: '#061230',
            headerBg: '#061230',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
