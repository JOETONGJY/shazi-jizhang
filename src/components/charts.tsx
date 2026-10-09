import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import type { MonthPoint } from '../logic/stats';
import { monthLabel } from '../logic/dates';
import { fmtMoney } from '../logic/stats';
import { useApp } from '../state/AppStore';

/** 近N个月收支双柱（View实现，无需图表库） */
export function TrendChart({ data }: { data: MonthPoint[] }) {
  const { palette } = useApp();
  const max = Math.max(...data.map((d) => Math.max(d.expense, d.income)), 1);
  const eColor = palette.fitness ? '#FF375F' : '#FCA5A5';
  const iColor = palette.fitness ? '#30D158' : '#6EE7B7';
  return (
    <View>
      <View style={[st.chart, { borderBottomColor: palette.border }]}>
        {data.map((d, i) => (
          <View key={d.month} style={st.group}>
            <Bar value={d.expense} max={max} color={eColor} highlight={i === data.length - 1} ring={palette.danger} />
            <Bar value={d.income} max={max} color={iColor} highlight={i === data.length - 1} />
          </View>
        ))}
      </View>
      <View style={st.xrow}>
        {data.map((d) => (
          <Text key={d.month} style={[st.xlab, { color: palette.faint }]}>{monthLabel(d.month).replace(/年|\d{4}/g, '')}</Text>
        ))}
      </View>
    </View>
  );
}

function Bar({ value, max, color, highlight, ring }: {
  value: number; max: number; color: string; highlight?: boolean; ring?: string;
}) {
  const h = Math.max((value / max) * 100, 2);
  return (
    <View style={[st.bar, {
      height: `${h}%` as `${number}%`,
      backgroundColor: color,
      ...(highlight && ring ? { borderWidth: 1.5, borderColor: ring } : null),
    }]} />
  );
}

/** 日历热力图（有账单的日期可点击，右上角带小圆点提示） */
export function CalendarHeat({ cells, values, today, month, onDayPress, activeDays }: {
  cells: (number | null)[];
  /** day -> expense */
  values: Map<number, number>;
  today: string;
  month: string;
  onDayPress?: (day: number) => void;
  /** 有账单（含收入）的日期集合，决定可点击与圆点提示 */
  activeDays?: Set<number>;
}) {
  const { palette } = useApp();
  const max = Math.max(...[...values.values()], 1);
  return (
    <View style={st.cal}>
      {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
        <Text key={w} style={[st.wd, { color: palette.faint }]}>{w}</Text>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <View key={`b${i}`} style={st.cellWrap} />;
        const v = values.get(d) ?? 0;
        const alpha = v > 0 ? 0.15 + (v / max) * 0.75 : 0;
        const isToday = `${month}-${String(d).padStart(2, '0')}` === today;
        const hasTx = activeDays ? activeDays.has(d) : v > 0;
        const tappable = hasTx && onDayPress !== undefined;
        const content = (
          <View style={[st.cell, {
            backgroundColor: v > 0 ? `rgba(0,181,120,${alpha.toFixed(2)})` : palette.keyFnBg,
            ...(isToday ? { borderWidth: 2, borderColor: '#00B578' } : null),
          }]}>
            <Text style={[st.cellText, { color: isToday ? '#00A76F' : palette.faint }]}>{d}</Text>
            {hasTx && <View style={[st.cellDot, { backgroundColor: palette.primary }]} />}
          </View>
        );
        return tappable ? (
          <TouchableOpacity key={d} style={st.cellWrap} activeOpacity={0.6} onPress={() => onDayPress(d)}>{content}</TouchableOpacity>
        ) : (
          <View key={d} style={st.cellWrap}>{content}</View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 120, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  group: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' },
  bar: { width: 10, borderRadius: 3 },
  xrow: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingTop: 5 },
  xlab: { flex: 1, textAlign: 'center', fontSize: 9.5 },
  cal: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  wd: { width: '13.4%' as unknown as number, textAlign: 'center', fontSize: 9.5, marginBottom: 2 },
  cellWrap: { width: '13.4%' as unknown as number },
  cell: {
    width: '100%', aspectRatio: 1.15, borderRadius: 6,
    alignItems: 'flex-start', justifyContent: 'flex-start', padding: 3,
  },
  cellText: { fontSize: 9 },
  cellDot: { position: 'absolute', top: 3, right: 3, width: 4, height: 4, borderRadius: 2 },
});

export { fmtMoney };
