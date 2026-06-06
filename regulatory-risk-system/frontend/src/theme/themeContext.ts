import { createContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  setMode: () => {},
  toggleMode: () => {},
});
