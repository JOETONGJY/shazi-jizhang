import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../state/AppStore';
import type { Palette } from '../theme/themes';

/* 分类图标气泡底色：按 emoji 码点求和轮换，保证同图标同色 */
const PASTELS = ['#FFF1E0', '#E0EDFF', '#FDE4F0', '#DFF3F0', '#ECE4FA', '#E2F6E8', '#FFE9E9', '#EEF3F9'];
/** Fitness深色：同色相的半透明彩底 */
const DARK_TINTS = ['rgba(255,159,10,0.20)', 'rgba(10,132,255,0.22)', 'rgba(255,55,95,0.20)', 'rgba(48,209,88,0.20)', 'rgba(191,90,242,0.22)', 'rgba(255,214,10,0.20)', 'rgba(255,69,58,0.20)', 'rgba(142,142,147,0.28)'];

export function bgForIcon(icon: string): string {
  let sum = 0;
  for (const ch of icon) sum += ch.codePointAt(0) ?? 0;
  return PASTELS[sum % PASTELS.length];
}

export function bgForIconDark(icon: string): string {
  let sum = 0;
  for (const ch of icon) sum += ch.codePointAt(0) ?? 0;
  return DARK_TINTS[sum % DARK_TINTS.length];
}

export function IconBubble({ icon, size = 38, fontSize = 19 }: { icon: string; size?: number; fontSize?: number }) {
  const { dark } = useApp();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? bgForIconDark(icon) : bgForIcon(icon), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize }}>{icon}</Text>
    </View>
  );
}

/** 统一卡片风格：圆角20 + 描边 + 阴影 */
export function cardStyle(palette: Palette): Record<string, unknown> {
  return {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    ...(Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: palette.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    }) as object),
  };
}

export function Card({ style, children }: { style?: Record<string, unknown>; children: React.ReactNode }) {
  const { palette } = useApp();
  return <View style={[cardStyle(palette), style] as object[]}>{children}</View>;
}

/** 底部弹层（备注/日期/账户等通用容器）：圆角26 + 抓手 */
export function SheetModal({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { palette } = useApp();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[st.sheetBox, { backgroundColor: palette.card }]}>
        <View style={[st.handle, { backgroundColor: palette.border }]} />
        <View style={st.sheetHead}>
          <Text style={[st.sheetTitle, { color: palette.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[st.sheetClose, { color: palette.faint }]}>✕</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function Segmented({
  options, value, onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (k: string) => void;
}) {
  const { palette } = useApp();
  return (
    <View style={[st.seg, { backgroundColor: palette.keyFnBg }]}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[st.segItem, value === o.key && { backgroundColor: palette.primarySoft, borderWidth: 1.5, borderColor: palette.primary }]}
          onPress={() => onChange(o.key)}
        >
          <Text style={[st.segText, { color: palette.sub }, value === o.key && { color: palette.primary, fontWeight: '700' }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,25,0.55)' },
  sheetBox: {
    position: 'absolute', left: 10, right: 10, bottom: 10,
    borderRadius: 26, padding: 16, paddingBottom: 20,
    ...(Platform.select({
      android: { elevation: 12 },
      ios: { shadowColor: 'rgba(0,0,0,0.3)', shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
    }) as object),
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sheetClose: { color: '#9AA3AF', fontSize: 16, paddingHorizontal: 6 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10 },
  segText: { fontSize: 13, color: '#6B7280' },
});
