/** 周期记账的纯日期计算（可单测） */

export type Freq = 'monthly' | 'weekly';

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * 给定上次生成日期，算出下一个应生成的日期（严格晚于 afterDate）。
 * monthly: 每月 day 日（31日在小月收缩为月末）；weekly: 每"周 day"（1=周一…7=周日）。
 * 返回 null 表示不应该再生成（不会发生，防御用）。
 */
export function nextDueDate(freq: Freq, day: number, afterDate: string): string {
  const [y, m, d] = afterDate.split('-').map(Number);
  if (freq === 'monthly') {
    const clamped = Math.min(day, daysInMonth(y, m));
    const candidate = `${y}-${pad2(m)}-${pad2(clamped)}`;
    if (candidate > afterDate) return candidate;
    // 下个月（day 收缩到当月长度）
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return `${ny}-${pad2(nm)}-${pad2(Math.min(day, daysInMonth(ny, nm)))}`;
  }
  // weekly：afterDate 的下一天开始找 weekday 匹配
  const dt = new Date(y, m - 1, d);
  for (let i = 1; i <= 7; i++) {
    dt.setDate(dt.getDate() + 1);
    const wd = ((dt.getDay() + 6) % 7) + 1; // 1=周一…7=周日
    if (wd === day) return toDateStr(dt);
  }
  return toDateStr(dt); // 防御
}

/** 频率的中文描述 */
export function freqLabel(freq: Freq, day: number): string {
  if (freq === 'monthly') return `每月${day}日`;
  const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return `每${names[day] ?? '周'}`;
}
