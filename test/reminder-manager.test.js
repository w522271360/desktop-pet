const test = require('node:test');
const assert = require('node:assert/strict');

const { createReminderManager, normalizeReminder } = require('../reminder-manager');

function createMemoryStore(initial = {}) {
  const data = { ...initial };
  return {
    get: (key, fallback) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback),
    set: (key, value) => {
      data[key] = value;
    }
  };
}

const fixedNow = () => new Date('2026-05-27T08:00:00.000Z');
const options = {
  now: fixedNow,
  generateId: () => 'reminder-1'
};

test('normalizes reminder input and trims display text', () => {
  const reminder = normalizeReminder({
    title: '  喝水  ',
    note: '  站起来走走  ',
    scheduledAt: '2026-05-27T09:00:00+08:00',
    recurrence: { frequency: 'daily' }
  }, {}, options);

  assert.equal(reminder.id, 'reminder-1');
  assert.equal(reminder.title, '喝水');
  assert.equal(reminder.note, '站起来走走');
  assert.deepEqual(reminder.recurrence, { frequency: 'daily' });
  assert.equal(reminder.enabled, true);
  assert.equal(reminder.status, 'scheduled');
  assert.equal(reminder.acknowledgedAt, null);
  assert.equal(reminder.createdAt, '2026-05-27T08:00:00.000Z');
});

test('rejects reminders without title or valid time', () => {
  assert.throws(
    () => normalizeReminder({ title: '', scheduledAt: '2026-05-27T09:00:00Z' }, {}, options),
    /提醒标题不能为空/
  );
  assert.throws(
    () => normalizeReminder({ title: '喝水', scheduledAt: 'not-a-date' }, {}, options),
    /提醒时间无效/
  );
});

test('saves reminders sorted by scheduled time', () => {
  let nextId = 0;
  const manager = createReminderManager(createMemoryStore(), {
    now: fixedNow,
    generateId: () => `reminder-${++nextId}`
  });

  manager.saveReminder({ title: '晚提醒', scheduledAt: '2026-05-27T10:00:00Z' });
  manager.saveReminder({ title: '早提醒', scheduledAt: '2026-05-27T09:00:00Z' });

  assert.deepEqual(manager.listReminders().map(reminder => reminder.title), ['早提醒', '晚提醒']);
});

test('returns enabled unacknowledged due reminders only', () => {
  const manager = createReminderManager(createMemoryStore({
    reminders: [
      { id: 'a', title: '到点', scheduledAt: '2026-05-27T07:59:00.000Z', enabled: true, status: 'scheduled' },
      { id: 'b', title: '未来', scheduledAt: '2026-05-27T08:01:00.000Z', enabled: true, status: 'scheduled' },
      { id: 'c', title: '停用', scheduledAt: '2026-05-27T07:58:00.000Z', enabled: false, status: 'scheduled' },
      { id: 'd', title: '已确认', scheduledAt: '2026-05-27T07:57:00.000Z', enabled: true, status: 'acknowledged' }
    ]
  }), options);

  assert.deepEqual(manager.getDueReminders(fixedNow()).map(reminder => reminder.id), ['a']);
});

test('acknowledges a reminder and removes it from due results', () => {
  const store = createMemoryStore({
    reminders: [
      { id: 'a', title: '到点', scheduledAt: '2026-05-27T07:59:00.000Z', enabled: true, status: 'due' }
    ]
  });
  const manager = createReminderManager(store, options);

  const acknowledged = manager.acknowledgeReminder('a');

  assert.equal(acknowledged.status, 'acknowledged');
  assert.equal(acknowledged.acknowledgedAt, '2026-05-27T08:00:00.000Z');
  assert.deepEqual(manager.getDueReminders(fixedNow()), []);
});

test('acknowledges recurring reminders by scheduling the next occurrence', () => {
  const store = createMemoryStore({
    reminders: [
      {
        id: 'a',
        title: '喝水',
        scheduledAt: '2026-05-27T07:30:00.000Z',
        recurrence: { frequency: 'daily' },
        enabled: true,
        status: 'due'
      }
    ]
  });
  const manager = createReminderManager(store, options);

  const acknowledged = manager.acknowledgeReminder('a');

  assert.equal(acknowledged.status, 'scheduled');
  assert.equal(acknowledged.scheduledAt, '2026-05-28T07:30:00.000Z');
  assert.equal(acknowledged.acknowledgedAt, '2026-05-27T08:00:00.000Z');
  assert.deepEqual(manager.getDueReminders(fixedNow()), []);
});

test('skips missed interval occurrences when recurring reminders are acknowledged late', () => {
  const store = createMemoryStore({
    reminders: [
      {
        id: 'a',
        title: '站起来',
        scheduledAt: '2026-05-27T07:00:00.000Z',
        recurrence: { frequency: 'interval', intervalValue: 20, intervalUnit: 'minutes' },
        enabled: true,
        status: 'due'
      }
    ]
  });
  const manager = createReminderManager(store, options);

  const acknowledged = manager.acknowledgeReminder('a');

  assert.equal(acknowledged.status, 'scheduled');
  assert.equal(acknowledged.scheduledAt, '2026-05-27T08:20:00.000Z');
});
