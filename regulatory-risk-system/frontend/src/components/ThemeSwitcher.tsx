import { Segmented } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useThemeMode } from '../theme/useThemeMode';

export default function ThemeSwitcher() {
  const { mode, setMode } = useThemeMode();

  return (
    <div className="theme-switcher">
      <Segmented
        value={mode}
        onChange={(val) => setMode(val as 'dark' | 'light')}
        options={[
          {
            value: 'light',
            icon: <SunOutlined />,
            label: '浅色',
          },
          {
            value: 'dark',
            icon: <MoonOutlined />,
            label: '深色',
          },
        ]}
        size="small"
      />
    </div>
  );
}
