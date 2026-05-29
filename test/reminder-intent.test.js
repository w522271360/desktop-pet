const test = require('node:test');
const assert = require('node:assert/strict');

const { parseReminderRequest } = require('../renderer/reminder-intent');

const now = '2026-05-29T09:00:00+08:00';

test('parses relative reminder requests', () => {
  const result = parseReminderRequest('20分钟后提醒我喝水', { now });

  assert.equal(result.matched, true);
  assert.equal(result.needsClarification, false);
  assert.equal(result.reminder.title, '喝水');
  assert.equal(result.reminder.scheduledAt, '2026-05-29T01:20:00.000Z');
  assert.deepEqual(result.reminder.recurrence, { frequency: 'none' });
});

test('parses tomorrow morning reminder requests', () => {
  const result = parseReminderRequest('明天上午10点提醒我开会', { now });

  assert.equal(result.matched, true);
  assert.equal(result.reminder.title, '开会');
  assert.equal(result.reminder.scheduledAt, '2026-05-30T02:00:00.000Z');
});

test('parses daily evening reminder requests', () => {
  const result = parseReminderRequest('每天晚上9点提醒我吃药', { now });

  assert.equal(result.matched, true);
  assert.equal(result.reminder.title, '吃药');
  assert.equal(result.reminder.scheduledAt, '2026-05-29T13:00:00.000Z');
  assert.deepEqual(result.reminder.recurrence, { frequency: 'daily' });
});

test('parses interval recurrence reminder requests', () => {
  const result = parseReminderRequest('每隔20分钟提醒我站起来活动', { now });

  assert.equal(result.matched, true);
  assert.equal(result.reminder.title, '站起来活动');
  assert.equal(result.reminder.scheduledAt, '2026-05-29T01:20:00.000Z');
  assert.deepEqual(result.reminder.recurrence, {
    frequency: 'interval',
    intervalValue: 20,
    intervalUnit: 'minutes'
  });
});

test('asks for time when reminder request is incomplete', () => {
  const result = parseReminderRequest('提醒我买牛奶', { now });

  assert.equal(result.matched, true);
  assert.equal(result.needsClarification, true);
  assert.match(result.error, /提醒时间/);
});

test('ignores ordinary chat messages', () => {
  const result = parseReminderRequest('你觉得今天适合做什么', { now });

  assert.equal(result.matched, false);
});
