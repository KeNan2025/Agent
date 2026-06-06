import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ThemeContext, type ThemeMode } from './themeContext';
import { darkTokens, lightTokens, applyCssTokens } from './tokens';
import { getAntdTheme } from './antdTheme';

const STORAGE_KEY = 'theme-mode';

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Apply CSS variables + data-theme attribute whenever mode changes
  useEffect(() => {
    const tokens = mode === 'dark' ? darkTokens : lightTokens;
    applyCssTokens(tokens);
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const ctxValue = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);
  const antdThemeConfig = useMemo(() => getAntdTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={ctxValue}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          ...antdThemeConfig,
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
