import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../state/AppStore';
import { listTxByMonth, listTxAll, categoryMap, monthSums } from '../db/repo';
import { sumByCategory, fmtMoney, monthTotals, round2, monthlyTrend, dailyExpense } from '../logic/stats';
import { addMonths, calendarGrid, lastNMonths, monthLabel, todayStr } from '../logic/dates';
import { DonutChart } from '../components/DonutChart';
import { TrendChart, CalendarHeat } from '../components/charts';
import type { TxType } from '../types';

const SLICE_COLORS = ['#FFD60A', '#FF375F', '#0A84FF', '#BF5AF2', '#30D158', '#48484E'];

/** 金额拆成整数与小数两部分：整数大字一行，小数（含小数点）以小字下标缀于右下角 */
function splitMoney(n: number): { int: string; dec: string } {
  const [int, dec = '00'] = fmtMoney(n).split('.');
  return { int, dec };
}

/** 整数部分属性：单行 + 超 6 位数时轻微缩号兜底 */
const bigIntProps = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75 } as const;

export function StatsScreen() {
  const { palette, revision } = useApp();
  const today = todayStr();
  const curMonth = today.slice(0, 7);
  const [month, setMonth] = useState(curMonth);
  const [type, setType] = useState<TxType>('expense');

  const txs = useMemo(() => listTxByMonth(month), [month, revision]);
  const catMap = useMemo(() => categoryMap(), [revision]);
  const sums = useMemo(() => monthTotals(txs), [txs]);
  const all = useMemo(() => sumByCategory(txs, catMap, type), [txs, catMap, type]);
  const allTx = useMemo(() => listTxAll(), [revision]);
  const calendarValues = useMemo(() => {
    const m = dailyExpense(txs);
    const out = new Map<number, number>();
    m.forEach((v, k) => out.set(Number(k.slice(8)), v));
    return out;
  }, [txs]);

  const months = useMemo(() => lastNMonths(month, 6), [month]);
  const trend = useMemo(() => monthlyTrend(allTx, months), [allTx, months]);
  const daily = useMemo(() => {
    const m = dailyExpense(txs);
    const out = new Map<number, number>();
    m.forEach((v, k) => out.set(Number(k.slice(8)), v));
    return out;
  }, [txs]);

  const balance = round2(sums.income - sums.expense);
  const { days } = monthRangeOf(month);
  const isCurrent = month === curMonth;
  const dayNum = Number(today.slice(8));
  const elapsed = isCurrent ? dayNum : days;
  const dailyAvg = elapsed > 0 ? round2(sums.expense / elapsed) : 0;
  const prev = monthSums(addMonths(month, -1));
  const changePct = prev.expense > 0 ? Math.round(((sums.expense - prev.expense) / prev.expense) * 100) : null;
  const saveRate = sums.income > 0 ? Math.round((balance / sums.income) * 100) : null;
  const mExpense = splitMoney(sums.expense);
  const mIncome = splitMoney(sums.income);
  const mBalance = splitMoney(Math.abs(balance));
  const mDaily = splitMoney(dailyAvg);
  const maxTotal = all[0]?.total ?? 1;

  const top5 = all.slice(0, 5);
  const restTotal = all.slice(5).reduce((s, x) => s + x.total, 0);
  const slices = [
    ...top5.map((s, i) => ({ value: s.total, color: SLICE_COLORS[i], label: s.name })),
    ...(restTotal > 0 ? [{ value: restTotal, color: SLICE_COLORS[5], label: '其他' }] : []),
  ];

  const changeMonth = (d: number) => {
    const next = addMonths(month, d);
    if (next > curMonth) return;
    setMonth(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 116 }}>
        <View style={st.pageT}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: palette.text }}>统计</Text>
          <View style={st.monRow}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={8}><Text style={{ color: palette.faint }}>‹ </Text></TouchableOpacity>
            <Text style={{ fontSize: 12, color: palette.sub }}>{monthLabel(month)}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={8} disabled={month >= curMonth}>
              <Text style={{ color: palette.faint, opacity: month >= curMonth ? 0.4 : 1 }}> ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fitness概览卡：2×2彩色数字 */}
        <View style={[st.sumCard, { backgroundColor: palette.card }]}>
          <View style={st.sumGrid}>
            <View style={[st.sg, st.sgTL]}>
              <Text style={{ fontSize: 12, color: palette.sub, fontWeight: '600' }}>支出</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: palette.danger, fontVariant: ['tabular-nums'] }} {...bigIntProps}>¥{mExpense.int}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: palette.danger, paddingBottom: 4, fontVariant: ['tabular-nums'] }}>.{mExpense.dec}</Text>
              </View>
              <Text style={{ fontSize: 10.5, color: palette.faint, marginTop: 2 }}>{changePct !== null ? `环比上月 ${changePct >= 0 ? '+' : ''}${changePct}%` : ' '}</Text>
            </View>
            <View style={[st.sg, st.sgTR]}>
              <Text style={{ fontSize: 12, color: palette.sub, fontWeight: '600' }}>收入</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: palette.income, fontVariant: ['tabular-nums'] }} {...bigIntProps}>¥{mIncome.int}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: palette.income, paddingBottom: 4, fontVariant: ['tabular-nums'] }}>.{mIncome.dec}</Text>
              </View>
              <Text style={{ fontSize: 10.5, color: palette.faint, marginTop: 2 }}>本月到账</Text>
            </View>
            <View style={[st.sg, st.sgBL]}>
              <Text style={{ fontSize: 12, color: palette.sub, fontWeight: '600' }}>结余</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: balance >= 0 ? palette.income : palette.danger, fontVariant: ['tabular-nums'] }} {...bigIntProps}>{balance >= 0 ? '+' : '-'}¥{mBalance.int}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: balance >= 0 ? palette.income : palette.danger, paddingBottom: 4, fontVariant: ['tabular-nums'] }}>.{mBalance.dec}</Text>
              </View>
              <Text style={{ fontSize: 10.5, color: palette.faint, marginTop: 2 }}>{sums.income > 0 ? `储蓄率 ${Math.max(saveRate ?? 0, 0)}%` : ' '}</Text>
            </View>
            <View style={[st.sg, st.sgBR]}>
              <Text style={{ fontSize: 12, color: palette.sub, fontWeight: '600' }}>日均支出</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: palette.text, fontVariant: ['tabular-nums'] }} {...bigIntProps}>¥{mDaily.int}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text, paddingBottom: 4, fontVariant: ['tabular-nums'] }}>.{mDaily.dec}</Text>
              </View>
              <Text style={{ fontSize: 10.5, color: palette.faint, marginTop: 2 }}>按已过{elapsed}天</Text>
            </View>
          </View>
        </View>

        {/* 收支趋势 */}
        <View style={[st.card, { backgroundColor: palette.card }]}>
          <View style={st.cardHead}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>收支趋势</Text>
            <Text style={{ fontSize: 11, color: palette.faint }}>近6个月</Text>
          </View>
          <TrendChart data={trend} />
        </View>

        {/* 支出/收入构成 */}
        <View style={[st.card, { backgroundColor: palette.card }]}>
          <View style={st.cardHead}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{type === 'expense' ? '支出' : '收入'}构成</Text>
            <View style={st.typeToggle}>
              {([['expense', '支出'], ['income', '收入']] as const).map(([k, label]) => (
                <TouchableOpacity key={k} onPress={() => setType(k)}>
                  <Text style={{ fontSize: 11.5, color: type === k ? palette.primary : palette.faint, fontWeight: type === k ? '700' : '400' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {all.length === 0 ? (
            <Text style={{ color: palette.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 20 }}>暂无{type === 'expense' ? '支出' : '收入'}数据</Text>
          ) : (
            <>
              <View style={st.donutRow}>
                <DonutChart
                  slices={slices}
                  centerLabel={`本月${type === 'expense' ? '支出' : '收入'}`}
                  centerValue={`¥${fmtMoney(type === 'expense' ? sums.expense : sums.income)}`}
                  centerLabelColor={palette.sub}
                  centerValueColor={palette.text}
                />
                <View style={{ gap: 8 }}>
                  {slices.map((s) => (
                    <View key={s.label} style={st.legendRow}>
                      <View style={[st.dot, { backgroundColor: s.color }]} />
                      <Text style={{ fontSize: 12.5, color: palette.text }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[st.divider, { backgroundColor: palette.border }]} />
              {all.map((s, i) => (
                <View key={s.categoryId} style={st.rk}>
                  <Text style={{ fontSize: 15 }}>{s.icon}</Text>
                  <Text style={[st.rkName, { color: palette.text }]}>{s.name}</Text>
                  <View style={[st.rkBarBg, { backgroundColor: palette.keyFnBg }]}>
                    <View style={{
                      height: 5, borderRadius: 3,
                      width: `${Math.max((s.total / maxTotal) * 100, 3)}%` as `${number}%`,
                      backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length],
                    }} />
                  </View>
                  <Text style={[st.rkVal, { color: palette.text }]}>¥{fmtMoney(s.total)}</Text>
                  <Text style={[st.rkPct, { color: palette.faint }]}>{s.pct}%</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* 日历热力图 */}
        <View style={[st.card, { backgroundColor: palette.card }]}>
          <View style={st.cardHead}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>日历 · 每日支出</Text>
            <Text style={{ fontSize: 11, color: palette.faint }}>颜色越深花得越多</Text>
          </View>
          <CalendarHeat cells={calendarGrid(month)} values={calendarValues} today={today} month={month} />        </View>
      </ScrollView>
    </View>
  );
}

function monthRangeOf(month: string): { start: string; end: string; days: number } {
  const ym = month.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  return { start: `${ym}-01`, end: `${ym}-${new Date(y, m, 0).getDate()}`, days: new Date(y, m, 0).getDate() };
}

const st = StyleSheet.create({
  pageT: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 6 },
  monRow: { flexDirection: 'row', alignItems: 'center' },
  sumCard: { borderRadius: 20, marginHorizontal: 20, marginTop: 10, paddingHorizontal: 18, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(128,140,160,0.10)', elevation: 2 },
  sumGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  sg: { width: '50%', paddingVertical: 13, paddingHorizontal: 14 },
  sgTL: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(128,140,160,0.18)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,140,160,0.18)' },
  sgTR: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,140,160,0.18)' },
  sgBL: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(128,140,160,0.18)' },
  sgBR: {},
  card: { borderRadius: 20, marginHorizontal: 20, marginTop: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(128,140,160,0.10)', elevation: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeToggle: { flexDirection: 'row', gap: 12 },
  donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 6, marginBottom: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  rk: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  rkName: { width: 36, fontSize: 12.5 },
  rkBarBg: { flex: 1, height: 5, borderRadius: 3 },
  rkVal: { width: 58, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  rkPct: { width: 30, textAlign: 'right', fontSize: 10.5 },
  empty: { alignItems: 'center', marginTop: 60 },
});
