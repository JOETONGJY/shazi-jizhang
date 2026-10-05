import type { TxType, Tx, TxWithNames } from '../types';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtSigned(n: number, type: TxType): string {
  return `${type === 'income' ? '+' : '-'}¥${fmtMoney(n)}`;
}

export function monthTotals(txs: Pick<Tx, 'type' | 'amount'>[]): { expense: number; income: number } {
  let e = 0;
  let i = 0;
  for (const t of txs) {
    if (t.type === 'expense') e += t.amount;
    else i += t.amount;
  }
  return { expense: round2(e), income: round2(i) };
}

export interface CatSum {
  categoryId: number;
  name: string;
  icon: string;
  total: number;
  pct: number;
}

/** 按分类汇总某一类型的金额，降序；pct 为四舍五入百分比 */
export function sumByCategory(
  txs: Pick<Tx, 'type' | 'amount' | 'categoryId'>[],
  catMap: Map<number, { name: string; icon: string }>,
  type: TxType,
): CatSum[] {
  const acc = new Map<number, number>();
  let sum = 0;
  for (const t of txs) {
    if (t.type !== type) continue;
    acc.set(t.categoryId, (acc.get(t.categoryId) ?? 0) + t.amount);
    sum += t.amount;
  }
  const out: CatSum[] = [...acc.entries()].map(([categoryId, total]) => {
    const c = catMap.get(categoryId);
    return {
      categoryId,
      name: c?.name ?? '未知分类',
      icon: c?.icon ?? '📦',
      total: round2(total),
      pct: sum > 0 ? Math.round((total / sum) * 100) : 0,
    };
  });
  out.sort((a, b) => b.total - a.total);
  return out;
}

export interface DayGroup {
  date: string;
  expense: number;
  income: number;
  items: TxWithNames[];
}

/** 按日分组；要求 txs 已按 date desc, id desc 排序 */
export function groupByDay(txs: TxWithNames[]): DayGroup[] {
  const map = new Map<string, TxWithNames[]>();
  for (const t of txs) {
    const arr = map.get(t.date) ?? [];
    arr.push(t);
    map.set(t.date, arr);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items, ...monthTotals(items) }));
}

export interface MonthPoint {
  month: string;
  expense: number;
  income: number;
}

export function monthlyTrend(txs: Pick<Tx, 'type' | 'amount' | 'date'>[], months: string[]): MonthPoint[] {
  const map = new Map<string, { expense: number; income: number }>();
  for (const t of txs) {
    const k = t.date.slice(0, 7);
    const v = map.get(k) ?? { expense: 0, income: 0 };
    if (t.type === 'expense') v.expense += t.amount;
    else v.income += t.amount;
    map.set(k, v);
  }
  return months.map((m) => {
    const v = map.get(m) ?? { expense: 0, income: 0 };
    return { month: m, expense: round2(v.expense), income: round2(v.income) };
  });
}

/** 每日支出总额（日历热力图用） */
export function dailyExpense(txs: Pick<Tx, 'type' | 'amount' | 'date'>[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
  }
  return map;
}

/** 连续记账天数：从今天（今天没记则从昨天）往回数有账单的连续天数 */
export function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  const d = new Date();
  const key = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  if (!set.has(key(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(key(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
