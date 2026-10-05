import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';

export const DB_NAME = 'jizhang.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (db === null) db = SQLite.openDatabaseSync(DB_NAME);
  return db;
}

export function setDb(instance: SQLite.SQLiteDatabase | null): void {
  db = instance;
}

export function initDb(): SQLite.SQLiteDatabase {
  const d = getDb();
  d.execSync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📦',
      type TEXT NOT NULL CHECK (type IN ('expense','income')),
      parent_id INTEGER,
      sort INTEGER NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '💵',
      init_balance REAL NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('expense','income')),
      amount REAL NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      amount REAL NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_cat ON budgets(category_id) WHERE category_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS recurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('expense','income')),
      amount REAL NOT NULL,
      category_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      freq TEXT NOT NULL CHECK (freq IN ('monthly','weekly')),
      day INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_generated TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  seedIfEmpty(d);
  return d;
}

function seedIfEmpty(d: SQLite.SQLiteDatabase): void {
  const catCount = d.getAllSync<{ c: number }>('SELECT COUNT(*) AS c FROM categories')[0];
  if (catCount && catCount.c === 0) {
    // 支出一级6类（常用直选）
    const tops: Array<[string, string, number]> = [
      ['饮食', '🍚', 1], ['交通', '🚕', 2], ['购物', '🛍️', 3],
      ['医疗', '💊', 4], ['休闲娱乐', '🎮', 5], ['其他', '🧩', 6],
    ];
    let otherId = 0;
    for (const [name, icon, sort] of tops) {
      const r = d.runSync('INSERT INTO categories (name, icon, type, parent_id, sort, is_custom) VALUES (?, ?, ?, NULL, ?, 0)', name, icon, 'expense', sort);
      if (name === '其他') otherId = r.lastInsertRowId;
    }
    // 「其他」的分项
    const subs: Array<[string, string]> = [
      ['居家物业', '🏠'], ['通讯话费', '📱'], ['人情往来', '🎁'], ['金融保险', '🛡️'],
      ['学习进修', '📚'], ['宠物', '🐾'], ['旅行度假', '✈️'],
    ];
    subs.forEach(([name, icon], i) => {
      d.runSync('INSERT INTO categories (name, icon, type, parent_id, sort, is_custom) VALUES (?, ?, ?, ?, ?, 0)', name, icon, 'expense', otherId, i + 1);
    });
    // 收入4类
    const income: Array<[string, string]> = [['工资', '💰'], ['兼职', '💼'], ['理财', '📈'], ['其他', '🧧']];
    income.forEach(([name, icon], i) => {
      d.runSync('INSERT INTO categories (name, icon, type, parent_id, sort, is_custom) VALUES (?, ?, ?, NULL, ?, 0)', name, icon, 'income', i + 1);
    });
  }

  const accCount = d.getAllSync<{ c: number }>('SELECT COUNT(*) AS c FROM accounts')[0];
  if (accCount && accCount.c === 0) {
    const accs: Array<[string, string]> = [['现金', '💵'], ['微信', '💚'], ['支付宝', '💙'], ['银行卡', '💳']];
    accs.forEach(([name, icon], i) => {
      d.runSync('INSERT INTO accounts (name, icon, init_balance, sort, hidden) VALUES (?, ?, 0, ?, 0)', name, icon, i + 1);
    });
  }

  const defaults: Array<[string, string]> = [['theme', 'green'], ['dark', '0'], ['reminder', '0']];
  for (const [k, v] of defaults) {
    d.runSync('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)', k, v);
  }
}

/** 数据库文件位置（备份/恢复用） */
export function dbFile(): File {
  return new File(new Directory(Paths.document, 'SQLite'), DB_NAME);
}
