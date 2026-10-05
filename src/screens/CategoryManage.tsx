import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../state/AppStore';
import { addCategory, deleteCategory, listCategories } from '../db/repo';
import { IconBubble, SheetModal } from '../components/ui';
import type { Category } from '../types';

const EMOJIS = ['🍚', '🚕', '🛍️', '💊', '🎮', '🧩', '🏠', '📱', '🎁', '🛡️', '📚', '🐾', '✈️', '📷', '🏋️', '🎧', '🧴', '🎬'];

export function CategoryManage({ onClose }: { onClose: () => void }) {
  const { palette, revision, bump } = useApp();
  const [sheet, setSheet] = useState<null | { type: 'expense' | 'income'; parentId: number | null }>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');

  const cats = useMemo(() => listCategories(), [revision]);
  const expTop = cats.filter((c) => c.type === 'expense' && c.parentId === null);
  const other = expTop.find((c) => c.name === '其他');
  const expSubs = cats.filter((c) => c.parentId === other?.id);
  const income = cats.filter((c) => c.type === 'income' && c.parentId === null);

  function add() {
    const n = name.trim();
    if (!n) return;
    try {
      addCategory(n, icon, sheet!.type, sheet!.parentId);
      bump();
      setSheet(null);
      setName('');
    } catch {
      Alert.alert('提示', '同名分类可能已存在');
    }
  }

  function del(c: Category) {
    const r = deleteCategory(c.id);
    if (!r.ok) Alert.alert('无法删除', r.msg ?? '');
    else bump();
  }

  const CatRow = ({ c }: { c: Category }) => (
    <View style={[st.row, { borderBottomColor: palette.border }]}>
      <IconBubble icon={c.icon} size={32} fontSize={16} />
      <Text style={{ flex: 1, fontSize: 13.5, color: palette.text, marginLeft: 10 }}>{c.name}</Text>
      {!c.isCustom && <Text style={{ fontSize: 10, color: palette.faint, marginRight: 6 }}>内置</Text>}
      {c.isCustom && (
        <TouchableOpacity onPress={() => del(c)} hitSlop={8}>
          <Text style={{ color: palette.danger, fontSize: 12 }}>删除</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const AddRow = ({ label, type, parentId }: { label: string; type: 'expense' | 'income'; parentId: number | null }) => (
    <TouchableOpacity style={[st.row, { borderBottomWidth: 0 }]} onPress={() => { setName(''); setIcon('🏷️'); setSheet({ type, parentId }); }}>
      <View style={[st.addRow, { borderColor: palette.primary }]}><Text style={{ color: palette.primary, fontWeight: '700', fontSize: 12.5 }}>＋ {label}</Text></View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[st.topbar, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ color: palette.primary, fontSize: 14 }}>‹ 返回</Text></TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>分类管理</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView>
        <Text style={[st.gt, { color: palette.faint }]}>支出 · 一级分类（记账页直选）</Text>
        <View style={[st.card, { backgroundColor: palette.card }]}>
          {expTop.map((c) => <CatRow key={c.id} c={c} />)}
        </View>

        <Text style={[st.gt, { color: palette.faint }]}>支出 ·「其他」里的分项</Text>
        <View style={[st.card, { backgroundColor: palette.card }]}>
          {expSubs.map((c) => <CatRow key={c.id} c={c} />)}
          {other && <AddRow label="自定义分类（挂在「其他」下）" type="expense" parentId={other.id} />}
        </View>

        <Text style={[st.gt, { color: palette.faint }]}>收入</Text>
        <View style={[st.card, { backgroundColor: palette.card }]}>
          {income.map((c) => <CatRow key={c.id} c={c} />)}
          <AddRow label="自定义收入分类" type="income" parentId={null} />
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <SheetModal visible={sheet !== null} onClose={() => setSheet(null)} title="新增分类">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="分类名称"
          placeholderTextColor={palette.faint}
          maxLength={10}
          autoFocus
          style={[st.input, { backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
        />
        <View style={st.emojiRow}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => setIcon(e)} style={[st.emojiCell, icon === e && { backgroundColor: palette.primarySoft, borderWidth: 2, borderColor: palette.primary }]}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[st.primaryBtn, { backgroundColor: palette.primary }]} onPress={add}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>确定添加</Text>
        </TouchableOpacity>
      </SheetModal>
    </View>
  );
}

const st = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  gt: { fontSize: 11, paddingHorizontal: 18, marginTop: 14, marginBottom: 6 },
  card: { borderRadius: 18, marginHorizontal: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(128,140,160,0.12)', elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  addRow: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  emojiCell: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});
