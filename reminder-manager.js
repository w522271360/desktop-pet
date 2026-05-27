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
  return {
    id: existing.id || input.id || (options.generateId || generateId)(),
    title,
    note: String(input.note || '').trim(),
    scheduledAt: new Date(input.scheduledAt).toISOString(),
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
  normalizeReminder
};
