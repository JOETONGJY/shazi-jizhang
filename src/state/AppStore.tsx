import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { initDb } from '../db/database';
import { getMeta, setMeta, generateDueRecurrences } from '../db/repo';
import { todayStr } from '../logic/dates';
import { makePalette, type Palette } from '../theme/themes';
import type { ThemeName } from '../types';

const THEME_NAMES: ThemeName[] = ['green', 'blue', 'purple', 'orange'];

interface AppCtx {
  ready: boolean;
  /** 任意写操作后 +1，各屏据此重新查询 */
  revision: number;
  bump: () => void;
  themeName: ThemeName;
  dark: boolean;
  palette: Palette;
  setThemeName: (t: ThemeName) => void;
  setDark: (d: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [themeName, setThemeNameState] = useState<ThemeName>('green');
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    initDb();
    try {
      generateDueRecurrences(todayStr()); // 周期记账：把到期账单补记入账
    } catch {
      // 补记失败不阻塞启动
    }
    const t = getMeta('theme', 'green') as ThemeName;
    setThemeNameState(THEME_NAMES.includes(t) ? t : 'green');
    setDarkState(getMeta('dark', '0') === '1');
    setReady(true);
  }, []);

  const setThemeName = useCallback((t: ThemeName) => {
    setThemeNameState(t);
    setMeta('theme', t);
  }, []);

  const setDark = useCallback((d: boolean) => {
    setDarkState(d);
    setMeta('dark', d ? '1' : '0');
  }, []);

  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const palette = useMemo(() => makePalette(themeName, dark), [themeName, dark]);

  const value = useMemo(
    () => ({ ready, revision, bump, themeName, dark, palette, setThemeName, setDark }),
    [ready, revision, bump, themeName, dark, palette, setThemeName, setDark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}
