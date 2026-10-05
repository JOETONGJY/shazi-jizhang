import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../state/AppStore';
import { countTx, countDistinctDays, getMeta, setMeta } from '../db/repo';
import { THEME_COLORS } from '../theme/themes';
import { backupCount, exportCsv, restoreFrom, shareBackup } from '../db/files';
import { setDailyReminder } from '../logic/reminder';
import { dbFile } from '../db/database';
import type { ThemeName } from '../types';

export function MineScreen({ onOpen, onCheckUpdate }: { onOpen: (page: 'catManage' | 'accountManage' | 'budget' | 'recurrence') => void; onCheckUpdate: () => Promise<'latest' | 'available'> }) {
  const { palette, revision, themeName, dark, setThemeName, setDark, bump } = useApp();
  const [msg, setMsg] = useState('');
  const txCount = useMemo(() => countTx(), [revision]);
  const days = useMemo(() => countDistinctDays(), [revision]);
  const backups = useMemo(() => backupCount(), [revision]);
  const reminderOn = useMemo(() => getMeta('reminder', '0') === '1', [revision]);

  async function toggleReminder(v: boolean) {
    const r = await setDailyReminder(v, 21, 0);
    setMeta('reminder', r.ok && v ? '1' : '0');
    bump();
    setMsg(r.msg);
  }

  async function doRestore() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    const r = await restoreFrom(uri);
    if (r.ok) bump();
    setMsg(r.msg);
  }

  function showAbout() {
    AlertAbout(dbFile().uri);
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 116 }}>
        <View style={st.pageT}><Text style={{ fontSize: 19, fontWeight: '800', color: palette.text }}>我的</Text></View>

        {palette.fitness ? (
          <View style={[st.hero, { backgroundColor: palette.card }]}>
            <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#fff' }}>❄️ 啥子记账</Text>
            <Text style={{ fontSize: 11.5, color: palette.onGradSub, marginTop: 5 }}>数据保存在这台手机，不联网、不上传</Text>
            <View style={st.heroNums}>
              <Num v={String(txCount)} k="已记笔数" />
              <Num v={String(days)} k="坚持天数" />
              <Num v={String(backups)} k="份本地备份" />
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={[palette.gradFrom, palette.gradTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.hero}
          >
            <View style={st.blob1} />
            <View style={st.blob2} />
            <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#fff' }}>❄️ 啥子记账</Text>
            <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 5 }}>数据保存在这台手机，不联网、不上传</Text>
            <View style={st.heroNums}>
              <Num v={String(txCount)} k="已记笔数" />
              <Num v={String(days)} k="坚持天数" />
              <Num v={String(backups)} k="份本地备份" />
            </View>
          </LinearGradient>
        )}

        <Group title="外观" palette={palette}>
          <Row icon="🎨" iconBg="#EDE7F6" label="主题颜色" palette={palette}>
            <View style={st.dots}>
              {(Object.keys(THEME_COLORS) as ThemeName[]).map((k) => (
                <TouchableOpacity key={k} onPress={() => setThemeName(k)} style={[st.dot, { backgroundColor: THEME_COLORS[k].primary, ...(themeName === k ? { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 } : null), borderWidth: themeName === k ? 3 : 0, borderColor: palette.card }]} />
              ))}
            </View>
          </Row>
          <Row icon="🌙" iconBg="#F1F5F9" label="深色模式" palette={palette} last>
            <TouchableOpacity style={[st.switchTrack, { backgroundColor: dark ? palette.primary : '#D1D5DB' }]} onPress={() => setDark(!dark)}>
              <View style={[st.knob, dark && { alignSelf: 'flex-end' }]} />
            </TouchableOpacity>
          </Row>
        </Group>

        <Group title="记账设置" palette={palette}>
          <Row icon="🏷️" iconBg="#FFF3E0" label="分类管理" palette={palette} onPress={() => onOpen('catManage')} />
          <Row icon="💳" iconBg="#E3F2FD" label="账户管理" palette={palette} onPress={() => onOpen('accountManage')} />
          <Row icon="🔁" iconBg="#EDE7F6" label="周期记账" palette={palette} onPress={() => onOpen('recurrence')} />
          <Row icon="🎯" iconBg="#FFEBEE" label="预算设置" palette={palette} last onPress={() => onOpen('budget')} />
        </Group>

        <Group title="数据" palette={palette}>
          <Row icon="📤" iconBg="#E0F2F1" label="导出 CSV / Excel" palette={palette} onPress={async () => { const r = await exportCsv(); setMsg(r.msg); }} />
          <Row icon="💾" iconBg="#E8F5E9" label="备份与恢复" palette={palette} last onPress={() => {
            backupAlert({
              onBackup: async () => { const r = await shareBackup(); setMsg(r.msg); },
              onRestore: doRestore,
            });
          }} />
        </Group>

        <Group title="通用" palette={palette}>
          <Row icon="⏰" iconBg="#FFF3E0" label="每晚记账提醒（21:00）" palette={palette}>
            <TouchableOpacity style={[st.switchTrack, { backgroundColor: reminderOn ? palette.primary : '#D1D5DB' }]} onPress={() => toggleReminder(!reminderOn)}>
              <View style={[st.knob, reminderOn && { alignSelf: 'flex-end' }]} />
            </TouchableOpacity>
          </Row>
          <Row icon="🔒" iconBg="#F1F5F9" label="应用锁" palette={palette} p1 />
          <Row icon="⬆️" iconBg="#E8F5E9" label="检查更新" palette={palette} last onPress={async () => {
            setMsg('正在检查更新…');
            const r = await onCheckUpdate();
            setMsg(r === 'available' ? '发现新版本，请在弹窗中更新' : '当前已是最新版本');
          }} />
        </Group>

        <View style={st.trust}>
          <Text style={[st.trustChip, { backgroundColor: palette.primarySoft, color: palette.primary }]}>🔒 本地存储</Text>
          <Text style={[st.trustChip, { backgroundColor: palette.primarySoft, color: palette.primary }]}>🚫 无广告</Text>
          <Text style={[st.trustChip, { backgroundColor: palette.primarySoft, color: palette.primary }]}>♻️ 数据可导出</Text>
        </View>
        {msg !== '' && <Text style={{ textAlign: 'center', fontSize: 11.5, color: palette.primary, marginTop: 8, paddingHorizontal: 20 }}>{msg}</Text>}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function AlertAbout(dbPath: string) {
  import('react-native').then(({ Alert }) => {
    Alert.alert('关于 · 啥子记账 V1.0', `本地记账App，无服务器、无账号。\n\n数据文件位置：\n${dbPath}\n\n备份与导出建议定期进行。`);
  });
}

function backupAlert({ onBackup, onRestore }: { onBackup: () => void; onRestore: () => void }) {
  import('react-native').then(({ Alert }) => {
    Alert.alert('备份与恢复', '备份会把数据库文件复制一份并可分享保存；恢复会用备份文件覆盖当前数据。', [
      { text: '取消', style: 'cancel' },
      { text: '从备份恢复', onPress: onRestore },
      { text: '备份到文件', onPress: onBackup },
    ]);
  });
}

function Num({ v, k }: { v: string; k: string }) {
  return (
    <View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>{v}</Text>
      <Text style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{k}</Text>
    </View>
  );
}

function Group({ title, children, palette }: { title: string; children: React.ReactNode; palette: ReturnType<typeof useApp>['palette'] }) {
  return (
    <View style={[st.group, { backgroundColor: palette.card }]}>
      <Text style={{ fontSize: 11, color: palette.faint, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, iconBg, label, palette, p1, last, onPress, children }: {
  icon: string; iconBg: string; label: string;
  palette: ReturnType<typeof useApp>['palette'];
  p1?: boolean; last?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <View style={[st.rowIcon, { backgroundColor: iconBg }]}><Text style={{ fontSize: 15 }}>{icon}</Text></View>
      <Text style={[st.rowLabel, { color: palette.text }]}>{label}</Text>
      {p1 && <View style={[st.p1tag, { borderColor: palette.warn }]}><Text style={{ fontSize: 9.5, color: palette.warn }}>P1</Text></View>}
      {children ?? <Text style={{ color: palette.faint, fontSize: 15 }}>{onPress ? '›' : ''}</Text>}
    </>
  );
  if (onPress || p1) {
    return <TouchableOpacity style={[st.row, !last && st.rowBorder]} onPress={p1 ? undefined : onPress} disabled={p1}>{body}</TouchableOpacity>;
  }
  return <View style={[st.row, !last && st.rowBorder]}>{body}</View>;
}

const st = StyleSheet.create({
  pageT: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 6 },
  hero: { marginHorizontal: 14, borderRadius: 24, padding: 18, overflow: 'hidden', elevation: 8 },
  blob1: { position: 'absolute', right: -34, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  blob2: { position: 'absolute', left: -26, bottom: -56, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroNums: { flexDirection: 'row', gap: 28, marginTop: 12 },
  group: { borderRadius: 18, marginHorizontal: 14, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(128,140,160,0.12)', elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  rowLabel: { flex: 1, fontSize: 13.5 },
  p1tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginRight: 4 },
  dots: { flexDirection: 'row', gap: 9 },
  dot: { width: 20, height: 20, borderRadius: 10 },
  switchTrack: { width: 40, height: 22, borderRadius: 12, padding: 2 },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  trust: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  trustChip: { fontSize: 10, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
});
