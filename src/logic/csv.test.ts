import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape, txToCsv, backupFileName } from './csv';
import type { TxWithNames } from '../types';

function tx(p: Partial<TxWithNames>): TxWithNames {
  return {
    id: 1, type: p.type ?? 'expense', amount: p.amount ?? 10,
    categoryId: 1, accountId: 1, date: p.date ?? '2026-10-01',
    note: p.note ?? '', createdAt: '', updatedAt: '',
    categoryName: p.categoryName ?? '饮食', categoryIcon: '🍚', accountName: p.accountName ?? '微信',
  };
}

test('csvEscape 需要转义的场景', () => {
  assert.equal(csvEscape('abc'), 'abc');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('他说"你好"'), '"他说""你好"""');
  assert.equal(csvEscape('a\nb'), '"a\nb"');
});

test('txToCsv 表头与行', () => {
  const csv = txToCsv([
    tx({ amount: 32, note: '黄焖鸡' }),
    tx({ type: 'income', amount: 12000.5, categoryName: '工资', date: '2026-10-02' }),
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '日期,类型,分类,金额,账户,备注');
  assert.equal(lines[1], '2026-10-01,支出,饮食,32.00,微信,黄焖鸡');
  assert.equal(lines[2], '2026-10-02,收入,工资,12000.50,微信,');
});

test('backupFileName 格式', () => {
  const name = backupFileName(new Date(2026, 9, 1, 8, 5, 9));
  assert.equal(name, 'jizhang-20261001-080509.db');
});
