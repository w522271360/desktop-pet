function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso() {
  return new Date().toISOString();
}

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

const REPEAT_FREQUENCIES = new Set(['none', 'daily', 'weekly', 'monthly', 'interval']);
const INTERVAL_UNITS = new Set(['minutes', 'hours', 'days']);

function normalizeRecurrence(input = {}, existing = {}) {
  const source = input.recurrence || input.repeat || existing.recurrence || {};
  const frequency = REPEAT_FREQUENCIES.has(source.frequency) ? source.frequency : 'none';

  if (frequency !== 'interval') {
    return { frequency };
  }

  const intervalValue = Math.max(1, Math.floor(Number(source.intervalValue || 1)));
  const intervalUnit = INTERVAL_UNITS.has(source.intervalUnit) ? source.intervalUnit : 'days';
  return {
    frequency,
    intervalValue,
    intervalUnit
  };
}

function hasRecurrence(reminder) {
  return reminder?.recurrence?.frequency && reminder.recurrence.frequency !== 'none';
}

function addRecurrenceStep(date, recurrence) {
  const next = new Date(date);

  if (recurrence.frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (recurrence.frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (recurrence.frequency === 'monthly') {
    const originalDate = next.getDate();
    next.setMonth(next.getMonth() + 1);
    if (next.getDate() !== originalDate) {
      next.setDate(0);
    }
  } else if (recurrence.frequency === 'interval') {
    const value = recurrence.intervalValue || 1;
    if (recurrence.intervalUnit === 'minutes') {
      next.setMinutes(next.getMinutes() + value);
    } else if (recurrence.intervalUnit === 'hours') {
      next.setHours(next.getHours() + value);
    } else {
      next.setDate(next.getDate() + value);
    }
  }

  return next;
}

function getNextScheduledAt(scheduledAt, recurrence, referenceDate = new Date()) {
  if (!recurrence || recurrence.frequency === 'none') return null;

  const referenceTime = referenceDate.getTime();
  let next = new Date(scheduledAt);
  if (Number.isNaN(next.getTime())) return null;

  if (recurrence.frequency === 'interval') {
    const intervalDurations = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };
    const duration = (recurrence.intervalValue || 1) * (intervalDurations[recurrence.intervalUnit] || intervalDurations.days);
    const missedCount = Math.max(0, Math.floor((referenceTime - next.getTime()) / duration) + 1);
    return new Date(next.getTime() + missedCount * duration).toISOString();
  }

  for (let i = 0; i < 1000 && next.getTime() <= referenceTime; i += 1) {
    next = addRecurrenceStep(next, recurrence);
  }

  return next.getTime() > referenceTime ? next.toISOString() : null;
}

function normalizeReminder(input, existing = {}, options = {}) {
  const title = String(input.title || '').trim();
  if (!title) {
    throw new Error('提醒标题不能为空');
  }

  if (!isValidDate(input.scheduledAt)) {
    throw new Error('提醒时间无效');
  }

  const timestamp = options.now ? options.now().toISOString() : nowIso();
  const status = input.status || existing.status || 'scheduled';
  const recurrence = normalizeRecurrence(input, existing);
  return {
    id: existing.id || input.id || (options.generateId || generateId)(),
    title,
    note: String(input.note || '').trim(),
    scheduledAt: new Date(input.scheduledAt).toISOString(),
    recurrence,
    enabled: input.enabled !== false,
    status,
    acknowledgedAt: status === 'acknowledged' ? (existing.acknowledgedAt || input.acknowledgedAt || null) : null,
    createdAt: existing.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function compareByScheduledAt(a, b) {
  return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
}

function createReminderManager(store, options = {}) {
  function listReminders() {
    return store.get('reminders', []).slice().sort(compareByScheduledAt);
  }

  function setReminders(reminders) {
    store.set('reminders', reminders.slice().sort(compareByScheduledAt));
  }

  function saveReminder(input) {
    const reminders = listReminders();
    const index = reminders.findIndex(reminder => reminder.id === input.id);
    const existing = index >= 0 ? reminders[index] : {};
    const reminder = normalizeReminder(input, existing, options);

    if (index >= 0) {
      reminders[index] = reminder;
    } else {
      reminders.push(reminder);
    }

    setReminders(reminders);
    return reminder;
  }

  function deleteReminder(id) {
    const reminders = listReminders();
    const nextReminders = reminders.filter(reminder => reminder.id !== id);
    setReminders(nextReminders);
    return nextReminders.length !== reminders.length;
  }

  function acknowledgeReminder(id) {
    const reminders = listReminders();
    const index = reminders.findIndex(reminder => reminder.id === id);
    if (index < 0) return null;

    const timestamp = options.now ? options.now().toISOString() : nowIso();
    if (hasRecurrence(reminders[index])) {
      const nextScheduledAt = getNextScheduledAt(reminders[index].scheduledAt, reminders[index].recurrence, new Date(timestamp));
      reminders[index] = {
        ...reminders[index],
        scheduledAt: nextScheduledAt || reminders[index].scheduledAt,
        status: 'scheduled',
        acknowledgedAt: timestamp,
        updatedAt: timestamp
      };
      setReminders(reminders);
      return reminders[index];
    }

    reminders[index] = {
      ...reminders[index],
      status: 'acknowledged',
      acknowledgedAt: timestamp,
      updatedAt: timestamp
    };
    setReminders(reminders);
    return reminders[index];
  }

  function getDueReminders(referenceDate = new Date()) {
    const referenceTime = referenceDate.getTime();
    return listReminders().filter(reminder => {
      if (!reminder.enabled || reminder.status === 'acknowledged') return false;
      return new Date(reminder.scheduledAt).getTime() <= referenceTime;
    });
  }

  function markReminderDue(id) {
    const reminders = listReminders();
    const index = reminders.findIndex(reminder => reminder.id === id);
    if (index < 0) return null;
    if (reminders[index].status === 'due') return reminders[index];

    const timestamp = options.now ? options.now().toISOString() : nowIso();
    reminders[index] = {
      ...reminders[index],
      status: 'due',
      updatedAt: timestamp
    };
    setReminders(reminders);
    return reminders[index];
  }

  return {
    listReminders,
    saveReminder,
    deleteReminder,
    acknowledgeReminder,
    getDueReminders,
    markReminderDue
  };
}

module.exports = {
  createReminderManager,
  getNextScheduledAt,
  normalizeReminder,
  normalizeRecurrence
};
