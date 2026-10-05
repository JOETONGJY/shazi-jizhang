export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function todayStr(): string {
  const n = new Date();
  return toStr(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 传入 'YYYY-MM-01' 形式或 'YYYY-MM' 均可 */
export function monthRange(month: string): { start: string; end: string; days: number } {
  const ym = month.slice(0, 7);
  const { y, m } = parseDate(`${ym}-01`);
  const days = daysInMonth(y, m);
  return { start: `${ym}-01`, end: `${ym}-${pad2(days)}`, days };
}

export function addMonths(month: string, delta: number): string {
  const ym = month.slice(0, 7);
  const { y, m } = parseDate(`${ym}-01`);
  let nm = m + delta;
  let ny = y + Math.floor((nm - 1) / 12);
  nm = (((nm - 1) % 12) + 12) % 12 + 1;
  return `${ny}-${pad2(nm)}`;
}

export function monthLabel(month: string): string {
  const { y, m } = parseDate(`${month.slice(0, 7)}-01`);
  return `${y}年${m}月`;
}

export function dayOfMonth(dateStr: string): number {
  return parseDate(dateStr).d;
}

export function dayLabel(dateStr: string, today: string): string {
  const a = parseDate(dateStr);
  const t = parseDate(today);
  const md = `${a.m}月${a.d}日`;
  if (dateStr === today) return `今天 · ${md}`;
  const yest = new Date(t.y, t.m - 1, t.d - 1);
  if (dateStr === toStr(yest.getFullYear(), yest.getMonth() + 1, yest.getDate())) return `昨天 · ${md}`;
  if (a.y !== t.y) return `${a.y}年${md}`;
  return md;
}

/** 日历网格：周一开头，null 为占位空白 */
export function calendarGrid(month: string): (number | null)[] {
  const ym = month.slice(0, 7);
  const { y, m } = parseDate(`${ym}-01`);
  const first = new Date(y, m - 1, 1);
  const wd = (first.getDay() + 6) % 7;
  const days = daysInMonth(y, m);
  const cells: (number | null)[] = [];
  for (let i = 0; i < wd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function lastNMonths(month: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(month, -i));
  return out;
}
