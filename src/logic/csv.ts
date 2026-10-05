import type { TxWithNames } from '../types';
import { pad2 } from './dates';

export function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export const CSV_HEADER = '日期,类型,分类,金额,账户,备注';

export function txToCsv(txs: TxWithNames[]): string {
  const lines = txs.map((t) =>
    [t.date, t.type === 'expense' ? '支出' : '收入', t.categoryName, t.amount.toFixed(2), t.accountName, t.note]
      .map(csvEscape)
      .join(','),
  );
  return [CSV_HEADER, ...lines].join('\r\n');
}

export function backupFileName(now: Date): string {
  return `jizhang-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}.db`;
}
