import { round2 } from './stats';

/** 键盘输入的金额中间态：字符串，最多一位小数点、两位小数、9位整数 */

function splitParts(s: string): [string, string | undefined] {
  const i = s.indexOf('.');
  if (i < 0) return [s, undefined];
  return [s.slice(0, i), s.slice(i + 1)];
}

export function pushDigit(cur: string, d: string): string {
  const [int, dec] = splitParts(cur);
  if (dec !== undefined) return dec.length >= 2 ? cur : cur + d;
  if (cur === '' && d === '0') return '';
  if (int === '0') return d === '0' ? cur : d;
  if (int.length >= 9) return cur;
  return cur + d;
}

export function pushDot(cur: string): string {
  if (cur.includes('.')) return cur;
  return cur === '' ? '0.' : `${cur}.`;
}

export function backspace(cur: string): string {
  return cur.slice(0, -1);
}

export function fmtAmountInput(cur: string): string {
  if (cur === '') return '0.00';
  const [int, dec] = splitParts(cur);
  if (dec === undefined) return `${int}.00`;
  return `${int}.${dec.padEnd(2, '0')}`;
}

export function parseAmount(cur: string): number | null {
  if (cur === '' || cur === '.') return null;
  const n = Number(cur);
  if (!Number.isFinite(n) || n <= 0) return null;
  return round2(n);
}
