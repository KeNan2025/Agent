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
          colorBgContainer: 'rgba(11, 17, 32, 0.85)',
          colorBgElevated: '#0f172a',
          colorBgLayout: '#020617',
          colorBorder: 'rgba(0, 212, 255, 0.12)',
          colorBorderSecondary: 'rgba(0, 212, 255, 0.08)',
          colorText: '#e8f4ff',
          colorTextSecondary: '#a0c8ff',
          colorTextTertiary: '#5a7fa0',
          colorTextQuaternary: '#3d5a73',
          colorFillSecondary: 'rgba(0, 212, 255, 0.04)',
          colorFillTertiary: 'rgba(0, 212, 255, 0.02)',
          colorSuccess: '#00ff88',
          colorWarning: '#ffbe0b',
          colorError: '#ff4757',
          colorInfo: '#00d4ff',
          borderRadius: 10,
          wireframe: false,
          fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#020617',
            headerBg: 'rgba(2, 6, 23, 0.85)',
            bodyBg: '#020617',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(0, 212, 255, 0.08)',
            darkItemSelectedColor: '#00d4ff',
            darkItemColor: 'rgba(160, 200, 255, 0.55)',
            darkItemHoverColor: 'rgba(160, 200, 255, 0.85)',
            darkItemHoverBg: 'rgba(0, 212, 255, 0.06)',
          },
          Table: {
            headerBg: 'rgba(0, 212, 255, 0.03)',
            headerColor: '#5a7fa0',
            rowHoverBg: 'rgba(0, 212, 255, 0.03)',
            borderColor: 'rgba(0, 212, 255, 0.08)',
          },
          Card: {
            colorBgContainer: 'rgba(11, 17, 32, 0.85)',
            colorBorderSecondary: 'rgba(0, 212, 255, 0.12)',
          },
          Input: {
            colorBgContainer: 'rgba(30, 41, 59, 0.6)',
            activeBorderColor: '#00d4ff',
          },
          Select: {
            colorBgContainer: 'rgba(30, 41, 59, 0.6)',
            optionActiveBg: 'rgba(0, 212, 255, 0.06)',
            optionSelectedBg: 'rgba(0, 212, 255, 0.10)',
          },
          Button: {
            primaryShadow: '0 0 15px rgba(0, 212, 255, 0.2)',
          },
          Progress: {
            remainingColor: 'rgba(255, 255, 255, 0.04)',
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Tabs: {
            inkBarColor: '#00d4ff',
            itemActiveColor: '#00d4ff',
            itemSelectedColor: '#00d4ff',
            itemHoverColor: '#e8f4ff',
          },
          Timeline: {
            dotBg: '#020617',
          },
          Collapse: {
            headerBg: 'transparent',
            contentBg: '#0b1120',
          },
          Alert: {
            colorInfoBg: 'rgba(0, 212, 255, 0.04)',
            colorInfoBorder: 'rgba(0, 212, 255, 0.12)',
          },
          Modal: {
            contentBg: '#0f172a',
            headerBg: '#0f172a',
          },
          Dropdown: {
            colorBgElevated: '#0f172a',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
