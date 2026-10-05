import React, { useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppStore';
import { listTxByMonth, categoryFilterIds, topCategories, listAccounts, listTxAll, countTx, getTotalBudget, monthSums } from '../db/repo';
import { fmtMoney, round2, computeStreak, monthTotals } from '../logic/stats';
import { addMonths, dayLabel, monthLabel, monthRange, todayStr } from '../logic/dates';
import { ActivityRings } from '../components/ActivityRings';
import { withAlpha } from '../theme/themes';

export function HomeScreen({ onEdit, onAdd }: { onEdit: (id: number) => void; onAdd: () => void }) {
  const { palette, revision } = useApp();
  const today = todayStr();
  const curMonth = today.slice(0, 7);
  const [month, setMonth] = useState(curMonth);
  const [filterCatId, setFilterCatId] = useState<number | null>(null);
  const [filterAccId, setFilterAccId] = useState<number | null>(null);
  const [filterSheet, setFilterSheet] = useState<null | 'cat' | 'acc' | 'mon'>(null);

  const txs = useMemo(
    () => listTxByMonth(
      month,
      filterCatId ? categoryFilterIds(filterCatId) : undefined,
      filterAccId ?? undefined,
    ),
    [month, filterCatId, filterAccId, revision],
  );
  const allTx = useMemo(() => listTxAll(), [revision]);
  const filterCats = useMemo(() => [
    ...topCategories('expense'),
    ...topCategories('income'),
  ], [revision]);
  const accounts = useMemo(() => listAccounts(false), [revision]);
  const filterName = filterCatId === null ? '全部' : filterCats.find((c) => c.id === filterCatId)?.name ?? '该分类';
  const accName = filterAccId === null ? '全部账户' : accounts.find((a) => a.id === filterAccId)?.name ?? '该账户';
  const streak = useMemo(() => computeStreak(allTx.map((t) => t.date)), [allTx]);
  const txCount = useMemo(() => countTx(), [revision]);

  // 简易按日分组（保持倒序）
  const groups: Array<{ date: string; expense: number; income: number; items: typeof txs }> = [];
  for (const t of txs) {
    const g = groups.find((x) => x.date === t.date);
    if (g) { g.items.push(t); if (t.type === 'expense') g.expense += t.amount; else g.income += t.amount; }
    else groups.push({ date: t.date, expense: t.type === 'expense' ? t.amount : 0, income: t.type === 'income' ? t.amount : 0, items: [t] });
  }

  const sums = useMemo(() => monthTotals(txs), [txs]);
  const balance = round2(sums.income - sums.expense);
  const { days } = monthRange(month);
  const isCurrent = month === curMonth;
  const dayNum = Number(today.slice(8));
  const elapsed = isCurrent ? dayNum : days;
  const dailyAvg = elapsed > 0 ? round2(sums.expense / elapsed) : 0;
  const totalBudget = useMemo(() => getTotalBudget(), [revision]);
  // 有预算：外环=预算消耗；无预算：外环=支出占收入比
  const outerPct = totalBudget > 0
    ? Math.min(sums.expense / totalBudget, 1)
    : sums.income > 0 ? sums.expense / sums.income : sums.expense > 0 ? 1 : 0;
  const rings = [
    { pct: outerPct, color: '#FF375F' },
    { pct: days > 0 ? elapsed / days : 0, color: '#A3FF2E' },
    { pct: sums.income > 0 ? Math.max(balance, 0) / sums.income : 0, color: '#0A84FF' },
  ];
  const overBudget = totalBudget > 0 && sums.expense > totalBudget;
  const totalSpentPct = totalBudget > 0 ? Math.round((sums.expense / totalBudget) * 100) : 0;
  const prevSums = monthSums(addMonths(month, -1));
  const changePct = prevSums.expense > 0 ? Math.round(((sums.expense - prevSums.expense) / prevSums.expense) * 100) : null;
  const changePctText = changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct}%` : '—';

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (filterSheet !== null) { setFilterSheet(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [filterSheet]);

  const changeMonth = (d: number) => {
    const next = addMonths(month, d);
    if (next > curMonth) return; // 不能跳到未来月份
    setMonth(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 176 }}>
        {/* 大数字头部 */}
        <View style={st.hh}>
          <TouchableOpacity style={st.monRow} onPress={() => setFilterSheet(filterSheet === 'mon' ? null : 'mon')}>
            <Text style={{ fontSize: 12, color: palette.sub }}>{monthLabel(month)} ‹ ›</Text>
          </TouchableOpacity>
          <Text style={[st.hhK, { color: palette.sub }]}>本月支出</Text>
          <Text style={[st.hhBig, { color: palette.text }]}>
            ¥{fmtMoney(sums.expense).replace(/\.00$/, '')}<Text style={{ fontSize: 20, color: palette.faint, fontWeight: '700' }}>.00</Text>
          </Text>
          <Text style={[st.hhMeta, { color: palette.sub }]}>
            收入 <Text style={{ color: palette.income, fontWeight: '700' }}>¥{fmtMoney(sums.income)}</Text>
            {'  ·  '}结余 <Text style={{ color: balance >= 0 ? palette.income : palette.danger, fontWeight: '700' }}>{balance >= 0 ? '+' : '-'}¥{fmtMoney(Math.abs(balance))}</Text>
            {'  ·  '}日均 <Text style={{ color: palette.text, fontWeight: '700' }}>¥{fmtMoney(dailyAvg)}</Text>
          </Text>
        </View>

        {/* 圆环徽章卡 */}
        <View style={[st.ringsCard, { backgroundColor: palette.card }]}>
          <ActivityRings
            size={76}
            rings={rings.map((r) => ({ ...r, bg: withAlpha(r.color, 0.22) }))}
          />
          <Text style={[st.ringTxt, { color: palette.sub }]}>
            {totalBudget > 0 ? (
              <>
                预算 <Text style={{ color: palette.text, fontWeight: '700' }}>¥{fmtMoney(totalBudget)}</Text> · 已用
                <Text style={{ color: totalSpentPct >= 100 ? palette.danger : totalSpentPct >= 80 ? palette.warn : palette.text, fontWeight: '700' }}> {Math.min(Math.round((sums.expense / totalBudget) * 100), 100)}%</Text>
                {'\n'}还可花 <Text style={{ color: totalBudget - sums.expense >= 0 ? palette.income : palette.danger, fontWeight: '700' }}>¥{fmtMoney(Math.max(totalBudget - sums.expense, 0))}</Text>
                {overBudget && <Text style={{ color: palette.danger, fontWeight: '700' }}> · 已超支</Text>}
              </>
            ) : (
              <>
                预算未设置 · 去 <Text style={{ color: palette.primary, fontWeight: '700' }}>我的-预算设置</Text> 开启
                {'\n'}日均 <Text style={{ color: palette.text, fontWeight: '700' }}>¥{fmtMoney(dailyAvg)}</Text> · 环比上月 {changePctText}
              </>
            )}
            {'\n'}记账 <Text style={{ color: palette.text, fontWeight: '700' }}>{txCount} 笔</Text> · 连续 <Text style={{ color: palette.text, fontWeight: '700' }}>{streak} 天</Text>
          </Text>
        </View>

        {/* 月份账单区：标题 + 文字筛选 */}
        <View style={st.secLine}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{monthLabel(month)}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setFilterSheet(filterSheet === 'cat' ? null : 'cat')}>
              <Text style={{ fontSize: 11.5, color: filterCatId ? palette.primary : palette.sub, fontWeight: filterCatId ? '700' : '400' }}>{filterName}</Text>
            </TouchableOpacity>
            <Text style={{ color: palette.border }}>·</Text>
            <TouchableOpacity onPress={() => setFilterSheet(filterSheet === 'acc' ? null : 'acc')}>
              <Text style={{ fontSize: 11.5, color: filterAccId ? palette.primary : palette.sub, fontWeight: filterAccId ? '700' : '400' }}>{accName}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 流水：发丝线行 */}
        {groups.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 38 }}>📭</Text>
            <Text style={{ color: palette.faint, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
              {monthLabel(month)}还没有账单{'\n'}点下方 ＋ 记第一笔
            </Text>
          </View>
        ) : (
          <View style={st.list}>
            {groups.map((g) => (
              <View key={g.date}>
                <View style={st.dayHead}>
                  <Text style={{ fontSize: 11, color: palette.faint }}>{dayLabel(g.date, today)}</Text>
                  <Text style={{ fontSize: 11, color: palette.faint }}>
                    {g.expense > 0 && `支出 ¥${fmtMoney(g.expense)}`}
                    {g.expense > 0 && g.income > 0 && ' · '}
                    {g.income > 0 && `收入 ¥${fmtMoney(g.income)}`}
                  </Text>
                </View>
                {g.items.map((t) => (
                  <TouchableOpacity key={t.id} style={[st.li, { borderBottomColor: palette.border }]} onPress={() => onEdit(t.id)} activeOpacity={0.6}>
                    <View style={st.cic}><Text style={{ fontSize: 14 }}>{t.categoryIcon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14.5, color: palette.text, fontWeight: '600' }} numberOfLines={1}>
                        {t.note ? `${t.categoryName} · ${t.note}` : t.categoryName}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: palette.faint, marginTop: 2 }}>{t.accountName}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: t.type === 'income' ? palette.income : palette.text, fontVariant: ['tabular-nums'] }}>
                      {t.type === 'income' ? '+' : '-'}¥{fmtMoney(t.amount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 月份选择弹层 */}
      {filterSheet === 'mon' && (
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setFilterSheet(null)}>
          <View style={[st.sheet, { backgroundColor: palette.card }]}>
            {[-2, -1, 0].map((d) => {
              const dt = new Date();
              dt.setDate(1);
              dt.setMonth(dt.getMonth() + d);
              const m = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
              if (m > curMonth) return null;
              return (
                <TouchableOpacity key={m} style={[st.monPick, month === m && { backgroundColor: palette.primarySoft }]} onPress={() => { setMonth(m); setFilterSheet(null); }}>
                  <Text style={{ color: month === m ? palette.primary : palette.text, fontWeight: month === m ? '700' : '400' }}>{monthLabel(m)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      )}

      {/* 分类筛选弹层 */}
      {filterSheet === 'cat' && (
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setFilterSheet(null)}>
          <View style={[st.sheet, { backgroundColor: palette.card }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, marginBottom: 10 }}>按分类筛选</Text>
            <View style={st.filterGrid}>
              <TouchableOpacity
                style={[st.filterCell, filterCatId === null && { backgroundColor: palette.primarySoft, borderWidth: 2, borderColor: palette.primary }]}
                onPress={() => { setFilterCatId(null); setFilterSheet(null); }}
              >
                <Text style={{ fontSize: 20 }}>🏷️</Text>
                <Text style={{ fontSize: 11.5, color: palette.text }}>全部</Text>
              </TouchableOpacity>
              {filterCats.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[st.filterCell, filterCatId === c.id && { backgroundColor: palette.primarySoft, borderWidth: 2, borderColor: palette.primary }]}
                  onPress={() => { setFilterCatId(c.id); setFilterSheet(null); }}
                >
                  <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                  <Text style={{ fontSize: 11.5, color: palette.text }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* 账户筛选弹层 */}
      {filterSheet === 'acc' && (
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setFilterSheet(null)}>
          <View style={[st.sheet, { backgroundColor: palette.card }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, marginBottom: 6 }}>按账户筛选</Text>
            <TouchableOpacity
              style={[st.accRow, filterAccId === null && { backgroundColor: palette.primarySoft }]}
              onPress={() => { setFilterAccId(null); setFilterSheet(null); }}
            >
              <Text style={{ fontSize: 18 }}>💳</Text>
              <Text style={{ flex: 1, fontSize: 13.5, color: palette.text, marginLeft: 10 }}>全部账户</Text>
              {filterAccId === null && <Text style={{ color: palette.primary, fontWeight: '700' }}>✓</Text>}
            </TouchableOpacity>
            {accounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[st.accRow, filterAccId === a.id && { backgroundColor: palette.primarySoft }]}
                onPress={() => { setFilterAccId(a.id); setFilterSheet(null); }}
              >
                <Text style={{ fontSize: 18 }}>{a.icon}</Text>
                <Text style={{ flex: 1, fontSize: 13.5, color: palette.text, marginLeft: 10 }}>{a.name}</Text>
                {filterAccId === a.id && <Text style={{ color: palette.primary, fontWeight: '700' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* 记一笔按钮：明细页底部的独立大按钮 */}
      <View style={[st.addWrap, { bottom: 10 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={onAdd} activeOpacity={0.85}>
          <LinearGradient
            colors={[palette.gradFrom, palette.gradTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[st.addBtn, { shadowColor: palette.primary }]}
          >
            <View style={st.addGloss} />
            <Text style={[st.addIcon, { color: palette.onAccent }]}>＋</Text>
            <Text style={[st.addTxt, { color: palette.onAccent }]}>记一笔</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SumCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>{label}</Text>
      <Text style={{ fontSize: 17.5, fontWeight: '700', color: '#FFFFFF', marginTop: 3 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  hh: { paddingHorizontal: 22, paddingTop: 50 },
  monRow: { alignSelf: 'flex-start' },
  hhK: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  hhBig: { fontSize: 42, fontWeight: '800', letterSpacing: -0.8, marginTop: 2, fontVariant: ['tabular-nums'] },
  hhMeta: { fontSize: 12, marginTop: 6, paddingBottom: 12 },
  ringsCard: { marginHorizontal: 20, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12 },
  ringTxt: { fontSize: 12, lineHeight: 21, flex: 1 },
  secLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 4 },
  list: { paddingHorizontal: 22 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 4 },
  li: { flexDirection: 'row', alignItems: 'center', height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  cic: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  empty: { alignItems: 'center', marginTop: 80 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,25,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30 },
  monPick: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterCell: { width: '22%', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(128,140,160,0.10)' },
  accRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10 },
  addWrap: { position: 'absolute', left: 20, right: 20 },
  addBtn: {
    height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    elevation: 10, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  addGloss: {
    position: 'absolute', top: 3, left: 14, right: 14, height: 22,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)',
  },
  addIcon: { fontSize: 22, fontWeight: '300', marginTop: -2 },
  addTxt: { fontSize: 16, fontWeight: '800', letterSpacing: 2 },
});
