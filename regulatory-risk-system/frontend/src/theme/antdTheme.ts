import type { ThemeConfig } from 'antd';
import type { ThemeMode } from './themeContext';

export function getAntdTheme(mode: ThemeMode): ThemeConfig {
  const isDark = mode === 'dark';

  return {
    algorithm: isDark ? undefined : undefined, // applied at ConfigProvider level
    token: {
      colorPrimary: '#1890ff',
      colorBgContainer: isDark ? '#171c24' : '#ffffff',
      colorBgElevated: isDark ? '#1f2530' : '#ffffff',
      colorBgLayout: isDark ? '#10151c' : '#f0f2f5',
      colorBorder: isDark ? 'rgba(24, 144, 255, 0.12)' : '#d9d9d9',
      colorBorderSecondary: isDark ? 'rgba(24, 144, 255, 0.08)' : '#f0f0f0',
      colorText: isDark ? '#e6edf3' : '#1f1f1f',
      colorTextSecondary: isDark ? '#8b949e' : '#595959',
      colorTextTertiary: isDark ? '#6e7681' : '#8c8c8c',
      colorTextQuaternary: isDark ? '#484f58' : '#bfbfbf',
      colorFillSecondary: isDark ? 'rgba(24, 144, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      colorFillTertiary: isDark ? 'rgba(24, 144, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#ff4d4f',
      colorInfo: '#1890ff',
      borderRadius: 8,
      wireframe: false,
      fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif',
    },
    components: {
      Layout: {
        siderBg: isDark ? '#102033' : '#ffffff',
        headerBg: isDark ? 'rgba(16, 21, 28, 0.88)' : 'rgba(255, 255, 255, 0.88)',
        bodyBg: isDark ? '#10151c' : '#f0f2f5',
      },
      Menu: {
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'transparent',
        darkItemSelectedBg: isDark ? 'rgba(24, 144, 255, 0.10)' : 'rgba(24, 144, 255, 0.08)',
        darkItemSelectedColor: '#1890ff',
        darkItemColor: isDark ? 'rgba(139, 148, 158, 0.65)' : 'rgba(89, 89, 89, 0.65)',
        darkItemHoverColor: isDark ? 'rgba(230, 237, 243, 0.85)' : 'rgba(31, 31, 31, 0.85)',
        darkItemHoverBg: isDark ? 'rgba(24, 144, 255, 0.06)' : 'rgba(24, 144, 255, 0.04)',
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemSelectedBg: isDark ? 'rgba(24, 144, 255, 0.10)' : 'rgba(24, 144, 255, 0.08)',
        itemSelectedColor: '#1890ff',
        itemColor: isDark ? '#8b949e' : '#595959',
        itemHoverColor: isDark ? '#e6edf3' : '#1f1f1f',
        itemHoverBg: isDark ? 'rgba(24, 144, 255, 0.06)' : 'rgba(24, 144, 255, 0.04)',
      },
      Table: {
        headerBg: isDark ? 'rgba(24, 144, 255, 0.03)' : '#fafafa',
        headerColor: isDark ? '#6e7681' : '#8c8c8c',
        rowHoverBg: isDark ? 'rgba(24, 144, 255, 0.04)' : 'rgba(24, 144, 255, 0.04)',
        borderColor: isDark ? 'rgba(24, 144, 255, 0.08)' : '#f0f0f0',
      },
      Card: {
        colorBgContainer: isDark ? '#171c24' : '#ffffff',
        colorBorderSecondary: isDark ? 'rgba(24, 144, 255, 0.10)' : '#e8e8e8',
      },
      Input: {
        colorBgContainer: isDark ? 'rgba(30, 37, 48, 0.8)' : '#fafafa',
        activeBorderColor: '#1890ff',
      },
      Select: {
        colorBgContainer: isDark ? 'rgba(30, 37, 48, 0.8)' : '#fafafa',
        optionActiveBg: isDark ? 'rgba(24, 144, 255, 0.06)' : 'rgba(24, 144, 255, 0.04)',
        optionSelectedBg: isDark ? 'rgba(24, 144, 255, 0.10)' : 'rgba(24, 144, 255, 0.08)',
      },
      Button: {
        primaryShadow: isDark
          ? '0 0 15px rgba(24, 144, 255, 0.2)'
          : '0 2px 4px rgba(24, 144, 255, 0.15)',
      },
      Progress: {
        remainingColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
      },
      Tag: {
        borderRadiusSM: 6,
      },
      Tabs: {
        inkBarColor: '#1890ff',
        itemActiveColor: '#1890ff',
        itemSelectedColor: '#1890ff',
        itemHoverColor: isDark ? '#e6edf3' : '#1f1f1f',
      },
      Timeline: {
        dotBg: isDark ? '#10151c' : '#f0f2f5',
      },
      Collapse: {
        headerBg: 'transparent',
        contentBg: isDark ? '#171c24' : '#fafafa',
      },
      Alert: {
        colorInfoBg: isDark ? 'rgba(24, 144, 255, 0.04)' : 'rgba(24, 144, 255, 0.04)',
        colorInfoBorder: isDark ? 'rgba(24, 144, 255, 0.12)' : 'rgba(24, 144, 255, 0.15)',
      },
      Modal: {
        contentBg: isDark ? '#1f2530' : '#ffffff',
        headerBg: isDark ? '#1f2530' : '#ffffff',
      },
      Dropdown: {
        colorBgElevated: isDark ? '#1f2530' : '#ffffff',
      },
    },
  };
}
