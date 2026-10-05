import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, addMonths, calendarGrid, lastNMonths, dayLabel, monthLabel } from './dates';

test('monthRange 常规月份', () => {
  const r = monthRange('2026-10');
  assert.deepEqual(r, { start: '2026-10-01', end: '2026-10-31', days: 31 });
});

test('monthRange 闰年二月', () => {
  assert.equal(monthRange('2024-02').days, 29);
  assert.equal(monthRange('2026-02').days, 28);
});

test('addMonths 跨年', () => {
  assert.equal(addMonths('2026-11', 2), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-03', -14), '2025-01');
});

test('calendarGrid 2026年10月（1日为周四，周一起始）', () => {
  const g = calendarGrid('2026-10');
  assert.equal(g.length % 7, 0);
  assert.equal(g[0], null);
  assert.equal(g[1], null);
  assert.equal(g[2], null);
  assert.equal(g[3], 1);
  assert.equal(g.filter((x) => x === 31).length, 1);
});

test('lastNMonths 倒序递增', () => {
  assert.deepEqual(lastNMonths('2026-03', 3), ['2026-01', '2026-02', '2026-03']);
});

test('dayLabel 今天/昨天/普通', () => {
  assert.equal(dayLabel('2026-10-01', '2026-10-01'), '今天 · 10月1日');
  assert.equal(dayLabel('2026-09-30', '2026-10-01'), '昨天 · 9月30日');
  assert.equal(dayLabel('2026-09-01', '2026-10-01'), '9月1日');
  assert.equal(dayLabel('2025-09-01', '2026-10-01'), '2025年9月1日');
});

test('monthLabel', () => {
  assert.equal(monthLabel('2026-10'), '2026年10月');
});
