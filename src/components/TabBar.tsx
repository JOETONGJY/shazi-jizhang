import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state/AppStore';
import type { Palette } from '../theme/themes';

export type TabKey = 'home' | 'stats' | 'mine';

const TABS: Array<{ key: TabKey; label: string; icon: string; iconActive: string }> = [
  { key: 'home', label: '明细', icon: 'receipt-outline', iconActive: 'receipt' },
  { key: 'stats', label: '统计', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { key: 'mine', label: '我的', icon: 'person-outline', iconActive: 'person' },
];

/** 极简底栏：三个SF Symbols风格Tab（记账按钮在明细页内） */
export function TabBar({ active, onTab }: {
  active: TabKey;
  onTab: (k: TabKey) => void;
}) {
  const { palette } = useApp();
  return (
    <View style={[st.bar, { borderTopColor: palette.cardBorder }]}>
      {TABS.map((t) => (
        <TabItem key={t.key} t={t} active={active === t.key} palette={palette} onPress={() => onTab(t.key)} />
      ))}
    </View>
  );
}

function TabItem({ t, active, palette, onPress }: {
  t: { key: TabKey; label: string; icon: string; iconActive: string };
  active: boolean;
  palette: Palette;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={st.tab} onPress={onPress} activeOpacity={0.6}>
      <Ionicons
        name={(active ? t.iconActive : t.icon) as never}
        size={23}
        color={active ? palette.primary : palette.faint}
      />
      <Text style={[st.label, { color: active ? palette.primary : palette.faint, fontWeight: active ? '700' : '400' }]}>{t.label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8, paddingBottom: 20, paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center' },
  label: { fontSize: 10.5, marginTop: 2 },
});
