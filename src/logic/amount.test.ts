import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushDigit, pushDot, backspace, fmtAmountInput, parseAmount } from './amount';

test('pushDigit 基本输入', () => {
  assert.equal(pushDigit('', '4'), '4');
  assert.equal(pushDigit('45', '0'), '450');
});

test('pushDigit 前导零处理', () => {
  assert.equal(pushDigit('', '0'), '');
  assert.equal(pushDigit('0', '5'), '5');
  assert.equal(pushDigit('0.', '0'), '0.0');
});

test('pushDigit 小数最多两位', () => {
  let s = '12.3';
  s = pushDigit(s, '4');
  assert.equal(s, '12.34');
  s = pushDigit(s, '5');
  assert.equal(s, '12.34');
});

test('pushDigit 整数最多9位', () => {
  let s = '';
  for (let i = 0; i < 12; i++) s = pushDigit(s, '1');
  assert.equal(s.length, 9);
});

test('pushDot 只允许一个', () => {
  assert.equal(pushDot('12'), '12.');
  assert.equal(pushDot('12.'), '12.');
  assert.equal(pushDot(''), '0.');
});

test('backspace', () => {
  assert.equal(backspace('12.3'), '12.');
  assert.equal(backspace(''), '');
});

test('fmtAmountInput 补齐两位小数', () => {
  assert.equal(fmtAmountInput(''), '0.00');
  assert.equal(fmtAmountInput('45'), '45.00');
  assert.equal(fmtAmountInput('45.0'), '45.00');
  assert.equal(fmtAmountInput('45.05'), '45.05');
});

test('parseAmount', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('0.00'), null);
  assert.equal(parseAmount('45.05'), 45.05);
  assert.equal(parseAmount('12.'), 12);
});
