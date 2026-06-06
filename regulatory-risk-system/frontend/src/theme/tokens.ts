/* ═══════════════════════════════════════════════════════════════════
   Design Tokens — Dark / Light
   GitHub Dark inspired palette
   ═══════════════════════════════════════════════════════════════════ */

export interface ThemeTokens {
  // Backgrounds
  bodyBg: string;
  layoutBg: string;
  containerBg: string;
  elevatedBg: string;
  mutedBg: string;
  sidebarBg: string;
  headerBg: string;
  inputBg: string;

  // Primary
  primary: string;
  primaryHover: string;
  primaryDim: string;
  primaryGlow: string;
  primaryGradient: string;

  // Semantic
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  purple: string;
  purpleSoft: string;
  cyan: string;
  cyanSoft: string;

  // Text
  textBright: string;
  textNormal: string;
  textDim: string;
  textFaint: string;

  // Borders
  borderDim: string;
  borderPanel: string;
  borderGlow: string;
  borderActive: string;
  divider: string;

  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
}

export const darkTokens: ThemeTokens = {
  bodyBg: '#0d1117',
  layoutBg: '#10151c',
  containerBg: '#171c24',
  elevatedBg: '#1f2530',
  mutedBg: '#252c36',
  sidebarBg: '#102033',
  headerBg: 'rgba(16, 21, 28, 0.88)',
  inputBg: 'rgba(30, 37, 48, 0.8)',

  primary: '#1890ff',
  primaryHover: '#40a9ff',
  primaryDim: 'rgba(24, 144, 255, 0.10)',
  primaryGlow: 'rgba(24, 144, 255, 0.18)',
  primaryGradient: 'linear-gradient(135deg, #1890ff, #096dd9)',

  danger: '#ff4d4f',
  dangerSoft: 'rgba(255, 77, 79, 0.10)',
  warning: '#faad14',
  warningSoft: 'rgba(250, 173, 20, 0.10)',
  success: '#52c41a',
  successSoft: 'rgba(82, 196, 26, 0.10)',
  purple: '#9254de',
  purpleSoft: 'rgba(146, 84, 222, 0.10)',
  cyan: '#13c2c2',
  cyanSoft: 'rgba(19, 194, 194, 0.10)',

  textBright: '#e6edf3',
  textNormal: '#8b949e',
  textDim: '#6e7681',
  textFaint: '#484f58',

  borderDim: 'rgba(24, 144, 255, 0.06)',
  borderPanel: 'rgba(24, 144, 255, 0.10)',
  borderGlow: 'rgba(24, 144, 255, 0.18)',
  borderActive: 'rgba(24, 144, 255, 0.35)',
  divider: 'rgba(24, 144, 255, 0.05)',

  shadowSm: '0 1px 3px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 16px rgba(0, 0, 0, 0.35)',
  shadowLg: '0 12px 32px rgba(0, 0, 0, 0.4)',
};

export const lightTokens: ThemeTokens = {
  bodyBg: '#f0f2f5',
  layoutBg: '#f0f2f5',
  containerBg: '#ffffff',
  elevatedBg: '#ffffff',
  mutedBg: '#f5f5f5',
  sidebarBg: '#ffffff',
  headerBg: 'rgba(255, 255, 255, 0.88)',
  inputBg: '#fafafa',

  primary: '#1890ff',
  primaryHover: '#40a9ff',
  primaryDim: 'rgba(24, 144, 255, 0.06)',
  primaryGlow: 'rgba(24, 144, 255, 0.12)',
  primaryGradient: 'linear-gradient(135deg, #1890ff, #096dd9)',

  danger: '#ff4d4f',
  dangerSoft: 'rgba(255, 77, 79, 0.06)',
  warning: '#faad14',
  warningSoft: 'rgba(250, 173, 20, 0.06)',
  success: '#52c41a',
  successSoft: 'rgba(82, 196, 26, 0.06)',
  purple: '#722ed1',
  purpleSoft: 'rgba(114, 46, 209, 0.06)',
  cyan: '#13c2c2',
  cyanSoft: 'rgba(19, 194, 194, 0.06)',

  textBright: '#1f1f1f',
  textNormal: '#595959',
  textDim: '#8c8c8c',
  textFaint: '#bfbfbf',

  borderDim: '#f0f0f0',
  borderPanel: '#e8e8e8',
  borderGlow: '#d9d9d9',
  borderActive: '#1890ff',
  divider: '#f0f0f0',

  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.03)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.08)',
  shadowLg: '0 8px 24px rgba(0, 0, 0, 0.12)',
};

/** Map token keys to CSS custom property names */
const tokenKeyToCssVar: Record<keyof ThemeTokens, string> = {
  bodyBg: '--body-bg',
  layoutBg: '--layout-bg',
  containerBg: '--container-bg',
  elevatedBg: '--elevated-bg',
  mutedBg: '--muted-bg',
  sidebarBg: '--sidebar-bg',
  headerBg: '--header-bg',
  inputBg: '--input-bg',
  primary: '--primary',
  primaryHover: '--primary-hover',
  primaryDim: '--primary-dim',
  primaryGlow: '--primary-glow',
  primaryGradient: '--primary-gradient',
  danger: '--danger',
  dangerSoft: '--danger-soft',
  warning: '--warning',
  warningSoft: '--warning-soft',
  success: '--success',
  successSoft: '--success-soft',
  purple: '--purple',
  purpleSoft: '--purple-soft',
  cyan: '--cyan',
  cyanSoft: '--cyan-soft',
  textBright: '--text-bright',
  textNormal: '--text-normal',
  textDim: '--text-dim',
  textFaint: '--text-faint',
  borderDim: '--border-dim',
  borderPanel: '--border-panel',
  borderGlow: '--border-glow',
  borderActive: '--border-active',
  divider: '--divider',
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
};

/** Apply tokens as CSS custom properties on :root */
export function applyCssTokens(tokens: ThemeTokens): void {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(tokenKeyToCssVar)) {
    root.style.setProperty(cssVar, tokens[key as keyof ThemeTokens]);
  }
}
