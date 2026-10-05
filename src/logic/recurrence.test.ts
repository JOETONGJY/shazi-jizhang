import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDueDate, freqLabel } from './recurrence';

test('nextDueDate 每月：同月未到则返回本月day', () => {
  assert.equal(nextDueDate('monthly', 15, '2026-10-02'), '2026-10-15');
});

test('nextDueDate 每月：已过则下月', () => {
  assert.equal(nextDueDate('monthly', 1, '2026-10-02'), '2026-11-01');
  assert.equal(nextDueDate('monthly', 2, '2026-10-02'), '2026-11-02');
});

test('nextDueDate 每月：31日在小月收缩为月末', () => {
  assert.equal(nextDueDate('monthly', 31, '2026-01-31'), '2026-02-28');
  // 闰年
  assert.equal(nextDueDate('monthly', 31, '2024-01-31'), '2024-02-29');
});

test('nextDueDate 每月：跨年', () => {
  assert.equal(nextDueDate('monthly', 5, '2026-12-31'), '2027-01-05');
});

test('nextDueDate 每周：找下一个指定星期', () => {
  // 2026-10-02 是周五
  assert.equal(nextDueDate('weekly', 5, '2026-10-02'), '2026-10-09'); // 下个周五
  assert.equal(nextDueDate('weekly', 6, '2026-10-02'), '2026-10-03'); // 明天周六
  assert.equal(nextDueDate('weekly', 1, '2026-10-02'), '2026-10-05'); // 下个周一
});

test('freqLabel', () => {
  assert.equal(freqLabel('monthly', 1), '每月1日');
  assert.equal(freqLabel('weekly', 5), '每周五');
});
