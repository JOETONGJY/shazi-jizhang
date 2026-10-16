import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Alert, BackHandler, LogBox, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
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
import { generateDueRecurrences, getMeta, setMeta, countTx } from './src/db/repo';
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

  const doCheckUpdate = React.useCallback(async (force = false): Promise<'latest' | 'available'> => {
    if (updateChecking.current) return 'latest';
    // 自动检查节流：6小时内只查一次（手动检查不受限）
    if (!force) {
      const last = Number(getMeta('last_update_check', '0')) || 0;
      if (Date.now() - last < 6 * 60 * 60 * 1000) return 'latest';
    }
    updateChecking.current = true;
    let info: UpdateInfo | null = null;
    try {
      info = await checkForUpdate();
      setMeta('last_update_check', String(Date.now())); // 只在成功拿到响应后计节流，失败下次启动重查
    } catch {
      // 网络失败：自动检查静默，不记节流时间
    } finally {
      updateChecking.current = false;
    }
    if (info) { setUpdateInfo(info); return 'available'; }
    return 'latest';
  }, []);

  // 数据就绪后2.5秒静默检查更新（发现新版本弹窗）
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { void doCheckUpdate(); }, 2500);
    return () => clearTimeout(t);
  }, [ready, doCheckUpdate]);

  // 全新安装（无任何账单）一次性提示：可以从备份文件恢复数据
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try {
        if (countTx() === 0 && getMeta('restore_hint', '0') !== '1') {
          setMeta('restore_hint', '1');
          Alert.alert(
            '是重装或换机了吗？',
            '以前的账单可以从备份文件恢复：「我的」→「备份与恢复」→「从备份恢复」。\n也可以设置「自动备份文件夹」，以后卸载重装都不怕。',
            [
              { text: '我知道了' },
              { text: '去「我的」看看', onPress: () => setTab('mine') },
            ],
          );
        }
      } catch {
        // 提示失败不影响使用
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [ready]);

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

  // 安卓返回键：分层退回——二级页关闭 / 其他Tab回明细 / 明细再按才退出
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlay !== null) { setOverlay(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false; // 主页默认退出
    });
    return () => sub.remove();
  }, [overlay, tab]);

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
        {tab === 'mine' && <MineScreen onOpen={(p) => setOverlay({ kind: p })} onCheckUpdate={() => doCheckUpdate(true)} />}
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
