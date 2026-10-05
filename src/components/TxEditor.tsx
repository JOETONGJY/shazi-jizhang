import React, { useMemo, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, Vibration, View,
} from 'react-native';
import { useApp } from '../state/AppStore';
import { addCategory, insertTx, updateTx, deleteTx, getTxWithNames, listAccounts, topCategories, subCategories } from '../db/repo';
import { backspace, fmtAmountInput, parseAmount, pushDigit, pushDot } from '../logic/amount';
import { todayStr, dayLabel } from '../logic/dates';
import type { NewTx, TxType } from '../types';
import { SheetModal } from './ui';

const CAT_EMOJIS = ['🍚', '🚕', '🛍️', '💊', '🎮', '🧩', '🏠', '📱', '🎁', '🛡️', '📚', '🐾', '✈️', '📷', '🏋️', '🎧'];

type SheetKind = null | 'date' | 'account' | 'addcat' | 'other';

export function TxEditor({ mode, txId, onClose }: {
  mode: 'create' | 'edit';
  txId?: number;
  onClose: () => void;
}) {
  const { palette, revision, bump } = useApp();
  const today = todayStr();

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [keypadOpen, setKeypadOpen] = useState(mode === 'create');
  const [inputMode, setInputMode] = useState<'amount' | 'note'>('amount');
  const [flash, setFlash] = useState('');
  const [subVersion, setSubVersion] = useState(0);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🏷️');

  // 数据（revision 变化时刷新，例如新增自定义分类后）
  const expenseTops = useMemo(() => topCategories('expense'), [revision]);
  const incomeTops = useMemo(() => topCategories('income'), [revision]);
  const otherCat = useMemo(() => expenseTops.find((c) => c.name === '其他') ?? null, [expenseTops]);
  const subs = useMemo(() => (otherCat ? subCategories(otherCat.id) : []), [otherCat, subVersion, revision]);
  const accounts = useMemo(() => listAccounts(false), [revision]);

  /** 类目列表：只放5个常用直选；其余收进「更多分类」面板 */
  const listCats: Array<{ id: number; name: string; icon: string; custom: boolean }> = useMemo(() => {
    if (type === 'income') {
      return [...incomeTops.map((c) => ({ id: c.id, name: c.name, icon: c.icon, custom: false }))];
    }
    return expenseTops
      .filter((c) => c.name !== '其他')
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, custom: false }));
  }, [type, expenseTops, incomeTops]);

  /** 「更多分类」面板里的类目（其他+分项） */
  const moreCats: Array<{ id: number; name: string; icon: string }> = useMemo(() => {
    if (type !== 'expense' || !otherCat) return [];
    return [{ id: otherCat.id, name: otherCat.name, icon: otherCat.icon }, ...subs.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))];
  }, [type, otherCat, subs]);

  // 编辑模式：载入原账单
  React.useEffect(() => {
    if (mode === 'edit' && txId) {
      const t = getTxWithNames(txId);
      if (!t) { onClose(); return; }
      setType(t.type);
      setAmount(String(t.amount));
      setCatId(t.categoryId);
      setNote(t.note);
      setDate(t.date);
      setAccountId(t.accountId);
    } else if (mode === 'create') {
      setCatId(expenseTops[0]?.id ?? null);
    }
  }, [mode]);

  React.useEffect(() => {
    if (mode === 'create' && accountId === null && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, mode, accountId]);

  const account = accounts.find((a) => a.id === accountId) ?? null;

  function switchType(t: TxType) {
    setType(t);
    const list = t === 'expense' ? expenseTops : incomeTops;
    setCatId(list[0]?.id ?? null);
  }

  function press(k: string) {
    if (/^[0-9]$/.test(k)) setAmount((a) => pushDigit(a, k));
    else if (k === '.') setAmount((a) => pushDot(a));
    else if (k === '⌫') setAmount((a) => backspace(a));
    else if (k === 'C') setAmount('');
    else if (k === 'save') doSave(false);
    else if (k === 'again') doSave(true);
    else if (k === 'done') setKeypadOpen(false);
  }

  function doSave(again: boolean) {
    const amt = parseAmount(amount);
    if (amt === null) { setFlash('请输入金额'); return; }
    if (catId === null) { setFlash('请选择分类'); return; }
    if (accountId === null) { setFlash('请选择账户'); return; }
    const n: NewTx = { type, amount: amt, categoryId: catId, accountId, date, note: note.trim() };
    try {
      if (mode === 'create') {
        insertTx(n);
        bump();
        Vibration.vibrate(15);
        if (again) {
          setAmount('');
          setNote('');
          setInputMode('amount');
          setFlash('✓ 已记一笔，继续');
        } else {
          onClose();
        }
      } else if (txId) {
        updateTx(txId, n);
        bump();
        onClose();
      }
    } catch (e) {
      setFlash(`保存失败：${String(e)}`);
    }
  }

  function doDelete() {
    if (!txId) return;
    Alert.alert('删除这笔账单？', '删除后不可恢复', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () => { deleteTx(txId); bump(); onClose(); },
      },
    ]);
  }

  const keysRows: Array<Array<{ k: string; label: string; fn?: boolean; w?: number }>> = [
    [{ k: '7', label: '7' }, { k: '8', label: '8' }, { k: '9', label: '9' }, { k: '⌫', label: '⌫', fn: true }],
    [{ k: '4', label: '4' }, { k: '5', label: '5' }, { k: '6', label: '6' }, { k: 'C', label: 'C', fn: true }],
    [{ k: '1', label: '1' }, { k: '2', label: '2' }, { k: '3', label: '3' }, { k: '.', label: '.', fn: true }],
    [{ k: '0', label: '0' }, { k: 'spacer', label: '' }, { k: '⌫2', label: '⌫', fn: true }],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* 顶栏 */}
      <View style={[st.topbar, { backgroundColor: palette.bg }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={[st.cancel, { color: palette.faint }]}>{mode === 'create' ? '取消' : '‹ 返回'}</Text></TouchableOpacity>
        <View style={st.typeSeg}>
          <TouchableOpacity onPress={() => switchType('expense')}>
            <Text style={[st.typeTxt, type === 'expense' && { color: palette.text, fontWeight: '700' }]}>支出</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => switchType('income')}>
            <Text style={[st.typeTxt, { color: type === 'income' ? palette.text : palette.sub, fontWeight: type === 'income' ? '700' : '400', marginLeft: 12 }]}>收入</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => doSave(false)} hitSlop={10}><Text style={[st.saveTxt, { color: palette.primary }]}>保存</Text></TouchableOpacity>
      </View>

      {flash !== '' && (
        <Text style={[st.flash, { color: palette.primary }]}>{flash}</Text>
      )}

      {/* 金额：居中极细，唯一焦点 */}
      <TouchableOpacity activeOpacity={mode === 'edit' ? 0.7 : 1} onPress={() => { setKeypadOpen(true); setInputMode('amount'); }}>
        <Text style={[st.amount, { color: palette.text }]} adjustsFontSizeToFit minimumFontScale={0.6}>
          <Text style={{ fontSize: 30, color: palette.faint, fontWeight: '300' }}>¥ </Text>{fmtAmountInput(amount)}
        </Text>
      </TouchableOpacity>

      {/* 元信息行：备注/日期/账户（纯文字） */}
      <View style={st.metaRow}>
        <TouchableOpacity hitSlop={6} onPress={() => { setInputMode(inputMode === 'note' ? 'amount' : 'note'); setKeypadOpen(false); }}>
          <Text style={{ color: inputMode === 'note' ? palette.primary : note ? palette.sub : palette.faint, fontWeight: inputMode === 'note' ? '700' : '400' }}>
            📝 {note || '备注'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={6} onPress={() => setSheet('date')}>
          <Text style={{ color: palette.sub }}>📅 {date === today ? '今天' : date.slice(5)}</Text>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={6} onPress={() => setSheet('account')}>
          <Text style={{ color: palette.sub }}>💳 {account?.name ?? '账户'}</Text>
        </TouchableOpacity>
      </View>

      {/* 类目列表：5个常用 + 「更多分类」入口 */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={st.clist}>
          {(() => {
            const visibleSel = listCats.find((c) => c.id === catId);
            const pinned = !visibleSel && catId !== null
              ? moreCats.find((c) => c.id === catId) ?? null
              : null;
            return pinned ? (
              <View style={[st.crow, { borderBottomColor: palette.border }]}>
                <View style={[st.cic, { backgroundColor: palette.card === '#000000' ? '#1C1C1E' : palette.keyFnBg }]}>
                  <Text style={{ fontSize: 13 }}>{pinned.icon}</Text>
                </View>
                <Text style={[st.cn, { color: palette.text, fontWeight: '700' }]}>{pinned.name}</Text>
                <Text style={[st.ck, { color: palette.primary }]}>✓</Text>
              </View>
            ) : null;
          })()}
          {listCats.map((c) => {
            const on = catId === c.id;
            return (
              <TouchableOpacity key={c.id} style={[st.crow, { borderBottomColor: palette.border }]} onPress={() => { setCatId(c.id); setInputMode('amount'); }}>
                <View style={[st.cic, { backgroundColor: palette.card === '#000000' ? '#1C1C1E' : palette.keyFnBg }]}>
                  <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                </View>
                <Text style={[st.cn, { color: palette.text }, on && { fontWeight: '700' }]}>{c.name}</Text>
                {on && <Text style={[st.ck, { color: palette.primary }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[st.crow, { borderBottomWidth: 0 }]} onPress={() => setSheet('other')}>
            <View style={[st.cic, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.primary, backgroundColor: 'transparent' }]}>
              <Text style={{ fontSize: 13, color: palette.primary }}>＋</Text>
            </View>
            <Text style={[st.cn, { color: palette.primary }]}>更多分类与自定义</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 底部：备注输入条 / 浮字键盘 / 编辑删除 */}
      {inputMode === 'note' ? (
        <View style={[st.noteBar, { borderTopColor: palette.border }]}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="输入备注（账单的补充说明）…"
            placeholderTextColor={palette.faint}
            maxLength={50}
            autoFocus
            style={[st.noteInput, { color: palette.text }]}
          />
          <TouchableOpacity style={[st.noteDone, { backgroundColor: palette.primary }]} onPress={() => setInputMode('amount')}>
            <Text style={{ color: palette.onAccent, fontWeight: '700', fontSize: 13 }}>完成</Text>
          </TouchableOpacity>
        </View>
      ) : keypadOpen ? (
        <View style={[st.keypad, { backgroundColor: palette.bg }]}>
          {keysRows.map((row, ri) => (
            <View key={ri} style={st.krow}>
              {row.map((k) =>
                k.k === 'spacer' ? (
                  <View key="sp" style={st.key} />
                ) : (
                  <TouchableOpacity key={k.k} style={st.key} onPress={() => press(k.k)}>
                    <Text style={[st.keyTxt, { color: k.fn ? palette.faint : palette.text }]}>{k.label}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={st.editActions}>
          <TouchableOpacity style={[st.ebtn, { borderWidth: 1.5, borderColor: palette.danger, backgroundColor: palette.card }]} onPress={doDelete}>
            <Text style={{ color: palette.danger, fontSize: 14, fontWeight: '700' }}>🗑 删除这笔</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 日期 */}
      <SheetModal visible={sheet === 'date'} onClose={() => setSheet(null)} title="选择日期">
        {Array.from({ length: 7 }, (_, i) => {
          const dd = new Date();
          dd.setDate(dd.getDate() - i);
          const s = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
          return (
            <TouchableOpacity key={s} style={[st.pickRow, date === s && { backgroundColor: palette.primarySoft }]} onPress={() => { setDate(s); setSheet(null); }}>
              <Text style={{ color: date === s ? palette.primary : palette.text, fontWeight: date === s ? '700' : '400' }}>
                {dayLabel(s, today)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </SheetModal>

      {/* 账户 */}
      <SheetModal visible={sheet === 'account'} onClose={() => setSheet(null)} title="选择账户">
        {accounts.map((a) => (
          <TouchableOpacity key={a.id} style={[st.pickRow, accountId === a.id && { backgroundColor: palette.primarySoft }]} onPress={() => { setAccountId(a.id); setSheet(null); }}>
            <Text style={{ fontSize: 18 }}>{a.icon}</Text>
            <Text style={{ marginLeft: 10, color: accountId === a.id ? palette.primary : palette.text, fontWeight: accountId === a.id ? '700' : '400' }}>{a.name}</Text>
          </TouchableOpacity>
        ))}
      </SheetModal>

      {/* 新增自定义分类 */}
      {/* 更多分类面板（其他+分项+自定义） */}
      <SheetModal visible={sheet === 'other'} onClose={() => setSheet(null)} title="更多分类">
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          {moreCats.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[st.pickRow, catId === c.id && { backgroundColor: palette.primarySoft }]}
              onPress={() => { setCatId(c.id); setInputMode('amount'); setSheet(null); }}
            >
              <Text style={{ fontSize: 18 }}>{c.icon}</Text>
              <Text style={{ marginLeft: 10, flex: 1, color: catId === c.id ? palette.primary : palette.text, fontWeight: catId === c.id ? '700' : '400' }}>{c.name}</Text>
              {catId === c.id && <Text style={[st.ck, { color: palette.primary }]}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[st.pickRow]} onPress={() => { setNewName(''); setNewIcon('🏷️'); setSheet('addcat'); }}>
            <Text style={{ fontSize: 18, color: palette.primary }}>＋</Text>
            <Text style={{ marginLeft: 10, color: palette.primary, fontWeight: '700', flex: 1 }}>自定义分类</Text>
          </TouchableOpacity>
        </ScrollView>
      </SheetModal>

      <SheetModal visible={sheet === 'addcat'} onClose={() => setSheet(null)} title="新增自定义分类">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="分类名称（如：化妆护肤）"
          placeholderTextColor={palette.faint}
          maxLength={10}
          style={[st.input, { backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
        />
        <View style={st.emojiRow}>
          {CAT_EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => setNewIcon(e)} style={[st.emojiCell, newIcon === e && { backgroundColor: palette.primarySoft, borderWidth: 2, borderColor: palette.primary }]}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[st.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={() => {
            const name = newName.trim();
            if (!name) return;
            try {
              const parentId = type === 'expense' ? (otherCat?.id ?? null) : null;
              const id = addCategory(name, newIcon, type, parentId);
              setSubVersion((v) => v + 1);
              setCatId(id);
              setSheet(null);
            } catch {
              setSheet(null);
              Alert.alert('提示', '该分类可能已存在');
            }
          }}
        >
          <Text style={{ color: palette.onAccent, fontWeight: '700' }}>确定添加</Text>
        </TouchableOpacity>
      </SheetModal>
    </View>
  );
}

const st = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 46, paddingBottom: 8 },
  cancel: { fontSize: 14.5 },
  saveTxt: { fontSize: 15, fontWeight: '700' },
  typeSeg: { flexDirection: 'row', alignItems: 'center' },
  typeTxt: { fontSize: 15 },
  flash: { textAlign: 'center', fontSize: 12.5, paddingVertical: 8 },
  amount: { textAlign: 'center', fontSize: 60, fontWeight: '200', letterSpacing: -1, paddingVertical: 26, fontVariant: ['tabular-nums'] },
  metaRow: { flexDirection: 'row', justifyContent: 'center', gap: 26, paddingBottom: 14 },
  clist: { flex: 1, paddingHorizontal: 24 },
  crow: { flexDirection: 'row', alignItems: 'center', height: 45, borderBottomWidth: StyleSheet.hairlineWidth },
  cic: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cn: { flex: 1, fontSize: 15 },
  ck: { fontSize: 16, fontWeight: '700' },
  addc: { paddingTop: 12, paddingBottom: 8 },
  keypad: { paddingHorizontal: 28, paddingBottom: 14 },
  krow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  key: { width: 62, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  keyTxt: { fontSize: 24, fontWeight: '300' },
  noteBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  noteInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  noteDone: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  editActions: { paddingHorizontal: 20, paddingBottom: 18 },
  ebtn: { paddingVertical: 13, borderRadius: 16, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  emojiCell: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10 },
});
