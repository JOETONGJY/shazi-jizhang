import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, LogBox, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Constants from 'expo-constants';
import { AppProvider, useApp } from './src/state/AppStore';
import { TabBar, type TabKey } from './src/components/TabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { MineScreen } from './src/screens/MineScreen';
import { TxEditor } from './src/components/TxEditor';
import { CategoryManage } from './src/screens/CategoryManage';
import { AccountManage } from './src/screens/AccountManage';
import { RecurrenceScreen } from './src/screens/RecurrenceScreen';
import { BudgetScreen } from './src/screens/BudgetScreen';
import { autoBackup } from './src/db/files';
import { generateDueRecurrences } from './src/db/repo';
import { todayStr } from './src/logic/dates';
import { checkForUpdate, type UpdateInfo } from './src/logic/updater';
import { UpdateModal } from './src/components/UpdateModal';

type Overlay =
  | null
  | { kind: 'record' }
  | { kind: 'edit'; id: number }
  | { kind: 'catManage' }
  | { kind: 'accountManage' }
  | { kind: 'budget' }
  | { kind: 'recurrence' };

/** 开屏：三月七头像 + 名称，淡入 + 弹性缩放（跟随明暗） */
function Splash({ dark, saved }: { dark: boolean; saved?: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);
  const bg = dark ? '#0B1220' : '#FFFFFF';
  const title = dark ? '#F3F4F6' : '#1F2937';
  const sub = dark ? '#64748B' : '#9AA3AF';
  return (
    <View style={[st.splash, { backgroundColor: bg }]}>
      <Animated.Image
        source={require('./assets/march7-avatar.png')}
        style={{ width: 112, height: 112, borderRadius: 27, opacity: fade, transform: [{ scale }] }}
      />
      <Animated.Text style={{ fontSize: 27, fontWeight: '800', color: title, marginTop: 20, opacity: fade, letterSpacing: 2 }}>
        啥子记账
      </Animated.Text>
      <Animated.Text style={{ fontSize: 13, color: sub, marginTop: 9, opacity: fade }}>
        {saved ? '本地账本 · 啥子都能记' : '正在打开你的本地账本…'}
      </Animated.Text>
    </View>
  );
}

function Shell() {
  const { ready, dark, palette } = useApp();
  const [tab, setTab] = useState<TabKey>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [splashGone, setSplashGone] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const sysDark = useColorScheme() === 'dark';
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const updateChecking = useRef(false);

  const doCheckUpdate = React.useCallback(async (): Promise<'latest' | 'available'> => {
    if (updateChecking.current) return 'latest';
    updateChecking.current = true;
    const info = await checkForUpdate();
    updateChecking.current = false;
    if (info) { setUpdateInfo(info); return 'available'; }
    return 'latest';
  }, []);

  // 数据就绪后2.5秒静默检查更新（发现新版本弹窗）
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { void doCheckUpdate(); }, 2500);
    return () => clearTimeout(t);
  }, [ready, doCheckUpdate]);

  // 退到后台时静默自动备份（滚动保留最近3份）
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') autoBackup();
    });
    return () => sub.remove();
  }, []);

  // 数据就绪后停留1.1秒再淡出开屏
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      Animated.timing(splashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setSplashGone(true));
    }, 1100);
    return () => clearTimeout(t);
  }, [ready, splashOpacity]);

  if (!ready) {
    return (
      <View style={[st.root, { backgroundColor: sysDark ? '#0B1220' : '#FFFFFF' }]}>
        <StatusBar barStyle={sysDark ? 'light-content' : 'dark-content'} />
        <Splash dark={sysDark} />
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen onEdit={(id) => setOverlay({ kind: 'edit', id })} onAdd={() => setOverlay({ kind: 'record' })} />}
        {tab === 'stats' && <StatsScreen />}
        {tab === 'mine' && <MineScreen onOpen={(p) => setOverlay({ kind: p })} onCheckUpdate={doCheckUpdate} />}
      </View>
      {overlay === null && (
        <TabBar active={tab} onTab={setTab} />
      )}

      {overlay !== null && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, zIndex: 100, elevation: 24 }]}>
          {overlay.kind === 'record' && <TxEditor mode="create" onClose={() => setOverlay(null)} />}
          {overlay.kind === 'edit' && <TxEditor mode="edit" txId={overlay.id} onClose={() => setOverlay(null)} />}
          {overlay.kind === 'catManage' && <CategoryManage onClose={() => setOverlay(null)} />}
          {overlay.kind === 'accountManage' && <AccountManage onClose={() => setOverlay(null)} />}
          {overlay.kind === 'budget' && <BudgetScreen onClose={() => setOverlay(null)} />}
          {overlay.kind === 'recurrence' && <RecurrenceScreen onClose={() => setOverlay(null)} />}
        </View>
      )}

      {/* 应用内更新弹窗 */}
      {updateInfo && (
        <UpdateModal info={updateInfo} localVersion={Constants.expoConfig?.version ?? ''} onClose={() => setUpdateInfo(null)} />
      )}

      {/* 开屏层：盖住一切直到动画结束 */}
      {!splashGone && (
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 30, opacity: splashOpacity }]}>
          <Splash dark={dark} saved />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  LogBox.ignoreAllLogs(true); // 开发期静音警告横幅（如blur的deprecation提示）
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
