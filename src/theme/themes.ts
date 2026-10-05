import type { ThemeName } from '../types';

export const THEME_COLORS: Record<ThemeName, { label: string; primary: string; primaryDark: string; fitnessAccent: string; onAccent: string }> = {
  green: { label: '薄荷绿', primary: '#10B981', primaryDark: '#047857', fitnessAccent: '#30D158', onAccent: '#06130A' },
  blue: { label: '天空蓝', primary: '#3B82F6', primaryDark: '#1D4ED8', fitnessAccent: '#0A84FF', onAccent: '#FFFFFF' },
  purple: { label: '暮光紫', primary: '#8B5CF6', primaryDark: '#6D28D9', fitnessAccent: '#BF5AF2', onAccent: '#FFFFFF' },
  orange: { label: '落日橙', primary: '#F97316', primaryDark: '#C2410C', fitnessAccent: '#FF9F0A', onAccent: '#1A0D00' },
};

export interface Palette {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  /** Fitness风格（深色）标志 */
  fitness: boolean;
  /** 强调色上的文字（Fitness绿底用黑字） */
  onAccent: string;
  /** Hero渐变卡起止色 */
  gradFrom: string;
  gradTo: string;
  /** 渐变上的次要文字 */
  onGradSub: string;
  bg: string;
  card: string;
  cardBorder: string;
  keyBg: string;
  keyFnBg: string;
  text: string;
  sub: string;
  faint: string;
  border: string;
  income: string;
  danger: string;
  warn: string;
  dim: string;
  onPrimary: string;
  /** 流水图标气泡的兜底底色 */
  bubble: string;
  /** 卡片阴影色 */
  shadow: string;
}

const LIGHT: Omit<Palette, 'primary' | 'primaryDark' | 'gradFrom' | 'gradTo' | 'onAccent'> = {
  fitness: false,
  primarySoft: 'rgba(16,185,129,0.12)',
  onGradSub: 'rgba(255,255,255,0.82)',
  bg: '#F3F5FA',
  card: '#FFFFFF',
  cardBorder: 'rgba(17,24,39,0.05)',
  keyBg: '#FFFFFF',
  keyFnBg: '#EEF1F6',
  text: '#111827',
  sub: '#6B7280',
  faint: '#9AA3AF',
  border: '#E5E7EB',
  income: '#059669',
  danger: '#EF4444',
  warn: '#F59E0B',
  dim: 'rgba(15,23,42,0.5)',
  onPrimary: '#FFFFFF',
  bubble: '#F1F5F9',
  shadow: 'rgba(15,23,42,0.10)',
};

/** Apple Fitness 深色：纯黑底 + #1C1C1E 卡片 + 多彩数据色 */
const FITNESS: Omit<Palette, 'primary' | 'primaryDark' | 'gradFrom' | 'gradTo' | 'onAccent'> = {
  fitness: true,
  primarySoft: 'rgba(48,209,88,0.16)',
  onGradSub: 'rgba(255,255,255,0.88)',
  bg: '#000000',
  card: '#1C1C1E',
  cardBorder: 'rgba(255,255,255,0.05)',
  keyBg: '#2C2C2E',
  keyFnBg: '#2C2C2E',
  text: '#FFFFFF',
  sub: '#8E8E93',
  faint: '#636366',
  border: '#2C2C2E',
  income: '#30D158',
  danger: '#FF375F',
  warn: '#FF9F0A',
  dim: 'rgba(0,0,0,0.62)',
  onPrimary: '#FFFFFF',
  bubble: '#2C2C2E',
  shadow: 'rgba(0,0,0,0.6)',
};

const OLD_DARK: Omit<Palette, 'primary' | 'primaryDark' | 'gradFrom' | 'gradTo' | 'onAccent'> = {
  ...FITNESS,
  bg: '#0B1220',
  card: '#151E2E',
  cardBorder: 'rgba(255,255,255,0.06)',
  keyBg: '#1C2739',
  keyFnBg: '#22304A',
  text: '#F3F4F6',
  sub: '#9CA3AF',
  faint: '#64748B',
  border: '#2A3650',
  income: '#34D399',
  danger: '#F87171',
  warn: '#FBBF24',
  bubble: '#22304A',
};

export function makePalette(name: ThemeName, dark: boolean): Palette {
  const t = THEME_COLORS[name];
  if (!dark) {
    return {
      ...LIGHT,
      primary: t.primary,
      primaryDark: t.primaryDark,
      primarySoft: withAlpha(t.primary, 0.12),
      gradFrom: t.primary,
      gradTo: t.primaryDark,
      onAccent: t.onAccent,
    };
  }
  // 深色 = Apple Fitness 风格；主题色映射为 Fitness 四色
  return {
    ...FITNESS,
    primary: t.fitnessAccent,
    primaryDark: t.primary,
    primarySoft: withAlpha(t.fitnessAccent, 0.16),
    gradFrom: t.fitnessAccent,
    gradTo: t.primaryDark,
    onAccent: t.onAccent,
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
