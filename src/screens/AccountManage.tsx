import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../state/AppStore';
import { accountInUse, addAccount, listAccounts, setAccountHidden } from '../db/repo';
import { IconBubble, SheetModal } from '../components/ui';

const ICONS = ['💵', '💳', '💚', '💙', '🏦', '🪙', '🎫', '🧧'];

export function AccountManage({ onClose }: { onClose: () => void }) {
  const { palette, revision, bump } = useApp();
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💵');
  const [balance, setBalance] = useState('');

  const accounts = useMemo(() => listAccounts(true), [revision]);

  function add() {
    const n = name.trim();
    if (!n) return;
    const b = Number(balance || '0');
    try {
      addAccount(n, icon, Number.isFinite(b) ? b : 0);
      bump();
      setSheet(false);
      setName('');
      setBalance('');
    } catch {
      Alert.alert('提示', '同名账户可能已存在');
    }
  }

  function toggleHidden(id: number, hidden: boolean) {
    setAccountHidden(id, hidden);
    bump();
  }

  function del(id: number) {
    if (accountInUse(id)) { Alert.alert('无法删除', '该账户已有账单'); return; }
    Alert.alert('删除账户？', '', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        // 账户没有账单时直接删除
        const { getDb } = require('../db/database') as typeof import('../db/database');
        getDb().runSync('DELETE FROM accounts WHERE id = ?', id);
        bump();
      } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[st.topbar, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ color: palette.primary, fontSize: 14 }}>‹ 返回</Text></TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>账户管理</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView>
        <Text style={[st.gt, { color: palette.faint }]}>隐藏的账户不会出现在记账页</Text>
        <View style={[st.card, { backgroundColor: palette.card }]}>
          {accounts.map((a, i) => (
            <View key={a.id} style={[st.row, i < accounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
              <IconBubble icon={a.icon} size={32} fontSize={16} />
              <Text style={{ flex: 1, fontSize: 13.5, color: palette.text, marginLeft: 10 }}>{a.name}</Text>
              <TouchableOpacity onPress={() => a.hidden || accountInUse(a.id) ? toggleHidden(a.id, !a.hidden) : del(a.id)} hitSlop={8}>
                <Text style={{ fontSize: 12, color: a.hidden ? palette.faint : palette.danger }}>
                  {a.hidden ? '取消隐藏' : '删除/隐藏'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => toggleHidden(a.id, !a.hidden)}>
                <Text style={{ fontSize: 12, color: a.hidden ? palette.faint : palette.text }}>{a.hidden ? '已隐藏' : '显示中'}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 11 }} onPress={() => { setName(''); setIcon('💵'); setBalance(''); setSheet(true); }}>
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 12.5 }}>＋ 新增账户</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <SheetModal visible={sheet} onClose={() => setSheet(false)} title="新增账户">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="账户名称（如：公交卡）"
          placeholderTextColor={palette.faint}
          maxLength={10}
          style={[st.input, { backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
        />
        <Text style={{ fontSize: 11.5, color: palette.faint, marginBottom: 6 }}>初始余额（可选，默认0）</Text>
        <TextInput
          value={balance}
          onChangeText={(t) => setBalance(t.replace(/[^0-9.]/g, ''))}
          placeholder="0.00"
          placeholderTextColor={palette.faint}
          keyboardType="decimal-pad"
          style={[st.input, { backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
        />
        <View style={st.emojiRow}>
          {ICONS.map((e) => (
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  emojiCell: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});
