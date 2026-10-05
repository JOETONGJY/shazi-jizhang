import type { Account, Category, NewTx, TxType, TxWithNames } from '../types';
import { getDb } from './database';
import { monthRange } from '../logic/dates';
import { nextDueDate } from '../logic/recurrence';
import { round2 } from '../logic/stats';

/* ---------------- 分类 ---------------- */

function rowToCategory(r: { id: number; name: string; icon: string; type: TxType; parent_id: number | null; sort: number; is_custom: number }): Category {
  return { id: r.id, name: r.name, icon: r.icon, type: r.type, parentId: r.parent_id, sort: r.sort, isCustom: r.is_custom === 1 };
}

export function listCategories(type?: TxType): Category[] {
  const rows = type
    ? getDb().getAllSync<any>('SELECT * FROM categories WHERE type = ? ORDER BY sort, id', type)
    : getDb().getAllSync<any>('SELECT * FROM categories ORDER BY type, sort, id');
  return rows.map(rowToCategory);
}

export function topCategories(type: TxType): Category[] {
  return listCategories(type).filter((c) => c.parentId === null);
}

export function subCategories(parentId: number): Category[] {
  return listCategories().filter((c) => c.parentId === parentId);
}

export function categoryMap(): Map<number, { name: string; icon: string }> {
  const m = new Map<number, { name: string; icon: string }>();
  for (const c of listCategories()) m.set(c.id, { name: c.name, icon: c.icon });
  return m;
}

export function addCategory(name: string, icon: string, type: TxType, parentId: number | null): number {
  const r = getDb().runSync(
    'INSERT INTO categories (name, icon, type, parent_id, sort, is_custom) VALUES (?, ?, ?, ?, 99, 1)',
    name, icon, type, parentId,
  );
  return r.lastInsertRowId;
}

export function categoryInUse(id: number): boolean {
  const r = getDb().getAllSync<{ c: number }>('SELECT COUNT(*) AS c FROM transactions WHERE category_id = ?', id)[0];
  return !!r && r.c > 0;
}

export function deleteCategory(id: number): { ok: boolean; msg?: string } {
  const cat = listCategories().find((c) => c.id === id);
  if (!cat) return { ok: false, msg: '分类不存在' };
  if (!cat.isCustom) return { ok: false, msg: '内置分类不能删除' };
  if (categoryInUse(id)) return { ok: false, msg: '该分类已有账单，不能删除' };
  getDb().runSync('DELETE FROM categories WHERE id = ?', id);
  return { ok: true };
}

/* ---------------- 账户 ---------------- */

function rowToAccount(r: any): Account {
  return { id: r.id, name: r.name, icon: r.icon, initBalance: r.init_balance, sort: r.sort, hidden: r.hidden === 1 };
}

export function listAccounts(includeHidden: boolean): Account[] {
  const rows = includeHidden
    ? getDb().getAllSync<any>('SELECT * FROM accounts ORDER BY sort, id')
    : getDb().getAllSync<any>('SELECT * FROM accounts WHERE hidden = 0 ORDER BY sort, id');
  return rows.map(rowToAccount);
}

export function addAccount(name: string, icon: string, initBalance: number): number {
  const r = getDb().runSync('INSERT INTO accounts (name, icon, init_balance, sort, hidden) VALUES (?, ?, ?, 99, 0)', name, icon, initBalance);
  return r.lastInsertRowId;
}

export function setAccountHidden(id: number, hidden: boolean): void {
  getDb().runSync('UPDATE accounts SET hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
}

export function accountInUse(id: number): boolean {
  const r = getDb().getAllSync<{ c: number }>('SELECT COUNT(*) AS c FROM transactions WHERE account_id = ?', id)[0];
  return !!r && r.c > 0;
}

/* ---------------- 账单 ---------------- */

const TX_SELECT = `
  SELECT t.id AS id, t.type AS type, t.amount AS amount, t.category_id AS categoryId,
         t.account_id AS accountId, t.date AS date, t.note AS note,
         t.created_at AS createdAt, t.updated_at AS updatedAt,
         c.name AS categoryName, c.icon AS categoryIcon, a.name AS accountName
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id
`;

export function insertTx(n: NewTx): number {
  const now = new Date().toISOString();
  const r = getDb().runSync(
    'INSERT INTO transactions (type, amount, category_id, account_id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    n.type, n.amount, n.categoryId, n.accountId, n.date, n.note, now, now,
  );
  return r.lastInsertRowId;
}

export function updateTx(id: number, n: NewTx): void {
  getDb().runSync(
    'UPDATE transactions SET type = ?, amount = ?, category_id = ?, account_id = ?, date = ?, note = ?, updated_at = ? WHERE id = ?',
    n.type, n.amount, n.categoryId, n.accountId, n.date, n.note, new Date().toISOString(), id,
  );
}

export function deleteTx(id: number): void {
  getDb().runSync('DELETE FROM transactions WHERE id = ?', id);
}

export function getTxWithNames(id: number): TxWithNames | null {
  const rows = getDb().getAllSync<TxWithNames>(`${TX_SELECT} WHERE t.id = ?`, id);
  return rows[0] ?? null;
}

export function listTxBetween(start: string, end: string, categoryIds?: number[], accountId?: number): TxWithNames[] {
  const conds: string[] = ['t.date BETWEEN ? AND ?'];
  const params: (string | number | null)[] = [start, end];
  if (categoryIds && categoryIds.length > 0) {
    conds.push(`t.category_id IN (${categoryIds.map(() => '?').join(',')})`);
    params.push(...categoryIds);
  }
  if (accountId) {
    conds.push('t.account_id = ?');
    params.push(accountId);
  }
  return getDb().getAllSync<TxWithNames>(
    `${TX_SELECT} WHERE ${conds.join(' AND ')} ORDER BY t.date DESC, t.id DESC`,
    ...params,
  );
}

export function listTxByMonth(month: string, categoryIds?: number[], accountId?: number): TxWithNames[] {
  const { start, end } = monthRange(month);
  return listTxBetween(start, end, categoryIds, accountId);
}

export function listTxAll(): TxWithNames[] {
  return getDb().getAllSync<TxWithNames>(`${TX_SELECT} ORDER BY t.date DESC, t.id DESC`);
}

/** 筛选分类时，把该分类及其子分类一起纳入 */
export function categoryFilterIds(categoryId: number): number[] {
  return [categoryId, ...subCategories(categoryId).map((c) => c.id)];
}

export function countTx(): number {
  const r = getDb().getAllSync<{ c: number }>('SELECT COUNT(*) AS c FROM transactions')[0];
  return r ? r.c : 0;
}

export function countDistinctDays(): number {
  const r = getDb().getAllSync<{ c: number }>('SELECT COUNT(DISTINCT date) AS c FROM transactions')[0];
  return r ? r.c : 0;
}

/* ---------------- 统计汇总（首页/统计页用） ---------------- */

export function monthSums(month: string): { expense: number; income: number } {
  const { start, end } = monthRange(month);
  const rows = getDb().getAllSync<{ type: TxType; total: number }>(
    'SELECT type, SUM(amount) AS total FROM transactions WHERE date BETWEEN ? AND ? GROUP BY type',
    start, end,
  );
  let expense = 0;
  let income = 0;
  for (const r of rows) {
    if (r.type === 'expense') expense = r.total;
    else income = r.total;
  }
  return { expense: round2(expense), income: round2(income) };
}

/* ---------------- 预算 ---------------- */

/** 总预算（category_id为NULL的行），未设置返回0 */
export function getTotalBudget(): number {
  const r = getDb().getAllSync<{ amount: number }>('SELECT amount FROM budgets WHERE category_id IS NULL');
  return r[0]?.amount ?? 0;
}

export function setTotalBudget(amount: number): void {
  const db = getDb();
  if (amount > 0) {
    const r = db.runSync('UPDATE budgets SET amount = ? WHERE category_id IS NULL', amount);
    if (r.changes === 0) db.runSync('INSERT INTO budgets (category_id, amount) VALUES (NULL, ?)', amount);
  } else {
    db.runSync('DELETE FROM budgets WHERE category_id IS NULL');
  }
}

/** 分类月预算：catId -> 金额 */
export function getCategoryBudgets(): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of getDb().getAllSync<{ category_id: number; amount: number }>('SELECT category_id, amount FROM budgets WHERE category_id IS NOT NULL')) {
    m.set(r.category_id, r.amount);
  }
  return m;
}

export function setCategoryBudget(categoryId: number, amount: number | null): void {
  const db = getDb();
  if (amount !== null && amount > 0) {
    const r = db.runSync('UPDATE budgets SET amount = ? WHERE category_id = ?', amount, categoryId);
    if (r.changes === 0) db.runSync('INSERT INTO budgets (category_id, amount) VALUES (?, ?)', categoryId, amount);
  } else {
    db.runSync('DELETE FROM budgets WHERE category_id = ?', categoryId);
  }
}

/* ---------------- 周期记账 ---------------- */

export interface Recurrence {
  id: number;
  name: string;
  type: TxType;
  amount: number;
  categoryId: number;
  accountId: number;
  freq: 'monthly' | 'weekly';
  day: number;
  note: string;
  startDate: string;
  active: boolean;
  lastGenerated: string | null;
}

function rowToRecurrence(r: any): Recurrence {
  return {
    id: r.id, name: r.name, type: r.type, amount: r.amount,
    categoryId: r.category_id, accountId: r.account_id,
    freq: r.freq, day: r.day, note: r.note,
    startDate: r.start_date, active: r.active === 1, lastGenerated: r.last_generated,
  };
}

export function listRecurrences(): Recurrence[] {
  return getDb().getAllSync<any>('SELECT * FROM recurrences ORDER BY id DESC').map(rowToRecurrence);
}

export interface NewRecurrence {
  name: string;
  type: TxType;
  amount: number;
  categoryId: number;
  accountId: number;
  freq: 'monthly' | 'weekly';
  day: number;
  note: string;
  startDate: string;
}

export function addRecurrence(n: NewRecurrence): number {
  const r = getDb().runSync(
    'INSERT INTO recurrences (name, type, amount, category_id, account_id, freq, day, note, start_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    n.name, n.type, n.amount, n.categoryId, n.accountId, n.freq, n.day, n.note, n.startDate,
  );
  return r.lastInsertRowId;
}

export function deleteRecurrence(id: number): void {
  getDb().runSync('DELETE FROM recurrences WHERE id = ?', id);
}

export function setRecurrenceActive(id: number, active: boolean): void {
  getDb().runSync('UPDATE recurrences SET active = ?, last_generated = NULL WHERE id = ?', active ? 1 : 0, id);
}

/**
 * 打开App时调用：把所有到期未生成的周期账单补记入账（支持关机跨天补记）。
 * 返回生成的笔数。
 */
export function generateDueRecurrences(todayStr: string): number {
  const rules = getDb().getAllSync<any>('SELECT * FROM recurrences WHERE active = 1');
  let created = 0;
  for (const r of rules) {
    const last = r.last_generated ?? null;
    if (last && last >= todayStr) continue; // 已生成到今天
    // 起算点：从未生成过则从 start_date 的前一天开始找
    let cursor = last ?? prevDay(r.start_date);
    if (cursor >= todayStr) continue;
    let guard = 0;
    let next = nextDueDate(r.freq as 'monthly' | 'weekly', r.day, cursor);
    const now = new Date();
    while (next <= todayStr && guard < 500) {
      // 停用前的旧账单也照记（规则的 active 只影响未来）
      getDb().runSync(
        'INSERT INTO transactions (type, amount, category_id, account_id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        r.type, r.amount, r.category_id, r.account_id, next, r.note, now.toISOString(), now.toISOString(),
      );
      created++;
      cursor = next;
      next = nextDueDate(r.freq as 'monthly' | 'weekly', r.day, cursor);
      guard++;
    }
    // last_generated 更新到“已处理到的日期”与今天中较小者
    const doneUpTo = next <= todayStr ? next : cursor;
    getDb().runSync('UPDATE recurrences SET last_generated = ? WHERE id = ?', doneUpTo < todayStr ? doneUpTo : todayStr, r.id);
  }
  return created;
}

function prevDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/* ---------------- meta ---------------- */

export function getMeta(key: string, def: string): string {
  const rows = getDb().getAllSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return rows[0]?.value ?? def;
}

export function setMeta(key: string, value: string): void {
  getDb().runSync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
