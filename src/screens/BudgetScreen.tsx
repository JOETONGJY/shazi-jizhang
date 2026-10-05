import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../state/AppStore';
import { getCategoryBudgets, getTotalBudget, listTxByMonth, setCategoryBudget, setTotalBudget, topCategories, categoryFilterIds, categoryMap, monthSums } from '../db/repo';
import { fmtMoney, sumByCategory } from '../logic/stats';
import { monthLabel, todayStr } from '../logic/dates';
import { SheetModal } from '../components/ui';

/** 预算设置：每月总预算 + 分类月预算（长期生效，不限月份） */
export function BudgetScreen({ onClose }: { onClose: () => void }) {
  const { palette, revision, bump } = useApp();
  const today = todayStr();
  const curMonth = today.slice(0, 7);
  const [edit, setEdit] = useState<null | { kind: 'total' } | { kind: 'cat'; id: number; name: string; cur: number | null }>(null);
  const [amount, setAmount] = useState('');

  const totalBudget = useMemo(() => getTotalBudget(), [revision]);
  const catBudgets = useMemo(() => getCategoryBudgets(), [revision]);
  const cats = useMemo(() => topCategories('expense'), [revision]);

  const monthTx = useMemo(() => listTxByMonth(curMonth), [curMonth, revision]);
  const catMap = useMemo(() => categoryMap(), [revision]);
  const spentByCat = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of cats) {
      const s = sumByCategory(listTxByMonth(curMonth, categoryFilterIds(c.id)), catMap, 'expense');
      m.set(c.id, s[0]?.total ?? 0);
    }
    return m;
  }, [cats, curMonth, revision]);

  const totalSpent = monthSums(curMonth).expense;
  const totalPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
  const over = totalBudget > 0 && totalSpent > totalBudget;

  function saveAmount() {
    const n = Number(amount.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(n)) return;
    if (edit?.kind === 'total') {
      setTotalBudget(n);
    } else if (edit?.kind === 'cat') {
      setCategoryBudget(edit.id, n > 0 ? n : null);
    }
    bump();
    setEdit(null);
    setAmount('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[st.topbar, { backgroundColor: palette.bg }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ color: palette.primary, fontSize: 14.5 }}>‹ 返回</Text></TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '800', color: palette.text }}>预算设置</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[st.hint, { color: palette.faint }]}>预算按自然月计算，每月1日清零重新累计。设置后首页圆环会实时显示消耗进度。</Text>

        {/* 总预算 */}
        <View style={[st.card, { backgroundColor: palette.card }]}>
          <TouchableOpacity style={st.row} onPress={() => { setAmount(totalBudget > 0 ? String(totalBudget) : ''); setEdit({ kind: 'total' }); }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: palette.text }}>每月总预算</Text>
              <Text style={{ fontSize: 11, color: palette.faint, marginTop: 3 }}>所有支出的合计上限</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: totalBudget > 0 ? palette.primary : palette.faint }}>
              {totalBudget > 0 ? `¥${fmtMoney(totalBudget)}` : '未设置'}
            </Text>
            <Text style={{ color: palette.faint, marginLeft: 8 }}>›</Text>
          </TouchableOpacity>
          {totalBudget > 0 && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <View style={[st.pbarBg, { backgroundColor: palette.keyFnBg }]}>
                <View style={{
                  height: 8, borderRadius: 4,
                  width: `${totalPct}%` as `${number}%`,
                  backgroundColor: over ? palette.danger : totalPct >= 80 ? palette.warn : palette.primary,
                }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: over ? palette.danger : palette.sub, fontWeight: '600' }}>
                  已花 ¥{fmtMoney(totalSpent)}（{totalPct}%）{over ? ' · 已超支' : ''}
                </Text>
                <Text style={{ fontSize: 11, color: palette.faint }}>剩余 ¥{fmtMoney(Math.max(totalBudget - totalSpent, 0))}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 分类预算 */}
        <Text style={[st.hint, { color: palette.faint, marginTop: 16 }]}>分类月预算（可选）：给花销大的类目单独设上限，超支会单独变色提醒</Text>
        <View style={[st.card, { backgroundColor: palette.card }]}>
          {cats.map((c) => {
            const budget = catBudgets.get(c.id) ?? 0;
            const spent = spentByCat.get(c.id) ?? 0;
            const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
            const cOver = budget > 0 && spent > budget;
            return (
              <TouchableOpacity
                key={c.id}
                style={[st.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
                onPress={() => { setAmount(budget > 0 ? String(budget) : ''); setEdit({ kind: 'cat', id: c.id, name: c.name, cur: budget > 0 ? budget : null }); }}
              >
                <Text style={{ fontSize: 17, marginRight: 12 }}>{c.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: palette.text, fontWeight: '600' }}>{c.name}</Text>
                    {budget > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <View style={[st.pbarBg, { width: 90, height: 5, backgroundColor: palette.keyFnBg }]}>
                          <View style={{ height: 5, borderRadius: 3, width: `${pct}%` as `${number}%`, backgroundColor: cOver ? palette.danger : palette.primary }} />
                        </View>
                        <Text style={{ fontSize: 10, color: cOver ? palette.danger : palette.faint }}>{pct}%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 10.5, color: palette.faint, marginTop: 3 }}>
                    {budget > 0 ? `预算 ¥${fmtMoney(budget)} · 已花 ¥${fmtMoney(spent)}` : '点此设置'}
                  </Text>
                </View>
                <Text style={{ color: palette.faint }}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[st.hint, { color: palette.faint, marginTop: 16, paddingHorizontal: 20 }]}>
          小技巧：先设总预算，再给餐饮、购物这类花销大的类目单独设上限。超支的类目在预算页会变红提醒。
        </Text>
      </ScrollView>

      {/* 金额输入弹层 */}
      <SheetModal visible={edit !== null} onClose={() => setEdit(null)} title={edit?.kind === 'total' ? '每月总预算' : `「${edit?.kind === 'cat' ? edit.name : ''}」月预算`}>
        <TextInput
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
          placeholder="输入金额（如 3000）"
          placeholderTextColor={palette.faint}
          keyboardType="decimal-pad"
          autoFocus
          style={[st.input, { backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(edit?.kind === 'cat' ? [1000, 2000, 3000] : [3000, 5000, 8000]).map((v) => (
            <TouchableOpacity key={v} style={[st.quickChip, { backgroundColor: palette.keyFnBg }]} onPress={() => setAmount(String(v))}>
              <Text style={{ color: palette.text, fontSize: 12.5 }}>¥{v}</Text>
            </TouchableOpacity>
          ))}
          {edit?.kind === 'cat' && edit.cur !== null && (
            <TouchableOpacity style={[st.quickChip, { backgroundColor: palette.keyFnBg }]} onPress={() => { setCategoryBudget(edit.id, null); bump(); setEdit(null); }}>
              <Text style={{ color: palette.danger, fontSize: 12.5 }}>清除</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[st.primaryBtn, { backgroundColor: palette.primary, marginTop: 12 }]} onPress={saveAmount}>
          <Text style={{ color: palette.onAccent, fontWeight: '800', fontSize: 15 }}>保存</Text>
        </TouchableOpacity>
      </SheetModal>
    </View>
  );
}

const st = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 },
  hint: { fontSize: 12, lineHeight: 19, paddingHorizontal: 20, marginBottom: 10 },
  card: { borderRadius: 18, marginHorizontal: 20, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(128,140,160,0.10)', elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  pbarBg: { borderRadius: 4, overflow: 'hidden' },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, marginBottom: 12 },
  primaryBtn: { alignItems: 'center', paddingVertical: 13, borderRadius: 14 },
});
