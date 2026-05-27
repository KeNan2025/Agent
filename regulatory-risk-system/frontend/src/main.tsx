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
          colorPrimary: '#1677ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#f5222d',
          colorInfo: '#1677ff',
          borderRadius: 8,
          fontSize: 14,
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
          controlHeight: 36,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f0f2f5',
        },
        components: {
          Card: {
            paddingLG: 20,
          },
          Table: {
            headerBg: '#fafafa',
            rowHoverBg: '#e6f4ff',
            borderColor: '#f0f0f0',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'transparent',
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
          },
          Tag: {
            borderRadiusSM: 4,
          },
          Tabs: {
            cardBg: '#fafafa',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
