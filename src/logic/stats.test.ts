import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumByCategory, groupByDay, monthlyTrend, monthTotals, fmtMoney } from './stats';
import type { TxWithNames } from '../types';

const catMap = new Map([
  [1, { name: '饮食', icon: '🍚' }],
  [2, { name: '交通', icon: '🚕' }],
  [6, { name: '其他', icon: '🧩' }],
]);

function tx(p: Partial<TxWithNames>): TxWithNames {
  return {
    id: p.id ?? 1,
    type: p.type ?? 'expense',
    amount: p.amount ?? 0,
    categoryId: p.categoryId ?? 1,
    accountId: p.accountId ?? 1,
    date: p.date ?? '2026-10-01',
    note: p.note ?? '',
    createdAt: '',
    updatedAt: '',
    categoryName: catMap.get(p.categoryId ?? 1)?.name ?? '未知分类',
    categoryIcon: catMap.get(p.categoryId ?? 1)?.icon ?? '📦',
    accountName: '微信',
  };
}

test('sumByCategory 汇总并降序', () => {
  const out = sumByCategory(
    [
      tx({ categoryId: 1, amount: 32 }),
      tx({ categoryId: 1, amount: 18 }),
      tx({ categoryId: 2, amount: 100 }),
    ],
    catMap,
    'expense',
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].name, '交通');
  assert.equal(out[0].total, 100);
  assert.equal(out[1].total, 50);
  assert.equal(out[1].pct, 33);
});

test('sumByCategory 过滤收入', () => {
  const out = sumByCategory([tx({ type: 'income', categoryId: 1, amount: 500 })], catMap, 'expense');
  assert.equal(out.length, 0);
});

test('monthTotals', () => {
  const t = monthTotals([tx({ amount: 10 }), tx({ type: 'income', amount: 100 }), tx({ amount: 5.5 })]);
  assert.deepEqual(t, { expense: 15.5, income: 100 });
});

test('groupByDay 日期倒序分组', () => {
  const groups = groupByDay([
    tx({ id: 3, date: '2026-10-01', amount: 68 }),
    tx({ id: 1, date: '2026-10-01', amount: 32 }),
    tx({ id: 2, date: '2026-09-30', amount: 18 }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-10-01');
  assert.equal(groups[0].expense, 100);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].date, '2026-09-30');
});

test('monthlyTrend 空月补零', () => {
  const out = monthlyTrend(
    [tx({ date: '2026-08-02', amount: 100 }), tx({ type: 'income', date: '2026-08-15', amount: 900 })],
    ['2026-07', '2026-08', '2026-09'],
  );
  assert.deepEqual(out, [
    { month: '2026-07', expense: 0, income: 0 },
    { month: '2026-08', expense: 100, income: 900 },
    { month: '2026-09', expense: 0, income: 0 },
  ]);
});

test('fmtMoney 千分位两位小数', () => {
  assert.equal(fmtMoney(4568), '4,568.00');
  assert.equal(fmtMoney(0.5), '0.50');
});
