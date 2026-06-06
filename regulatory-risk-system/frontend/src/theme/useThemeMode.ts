import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './themeContext';

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return ctx;
}
