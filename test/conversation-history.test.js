const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createConversationHistoryStore,
  deriveConversationTitle,
  normalizeTitle
} = require('../conversation-history');

function createMemoryStore(initial = {}) {
  const data = { ...initial };
  return {
    get: (key, fallback) => key in data ? data[key] : fallback,
    set: (key, value) => {
      data[key] = value;
    }
  };
}

test('derives compact titles from the first question', () => {
  assert.equal(deriveConversationTitle([{ question: '  帮我整理一下今天的会议纪要  ' }]), '帮我整理一下今天的会议纪要');
  assert.equal(
    deriveConversationTitle([{ question: 'abcdefghijklmnopqrstuvwxyz1234567890' }]),
    'abcdefghijklmnopqrstuvwxyz12...'
  );
});

test('normalizes empty conversation titles', () => {
  assert.equal(normalizeTitle('   '), '新对话');
  assert.equal(normalizeTitle('  API   调试 记录 '), 'API 调试 记录');
});

test('creates, renames, sorts, and deletes conversation records', () => {
  const manager = createConversationHistoryStore(createMemoryStore());
  const first = manager.upsert({
    updatedAt: '2026-05-27T08:00:00.000Z',
    messages: [{ question: '第一个问题', answer: '回答' }],
    apiMessages: [{ role: 'user', content: '第一个问题' }]
  });
  const second = manager.upsert({
    title: '第二段对话',
    updatedAt: '2026-05-27T09:00:00.000Z',
    messages: [{ question: '第二个问题', answer: '回答' }]
  });

  assert.equal(manager.getAll()[0].id, second.id);
  assert.equal(manager.get(first.id).title, '第一个问题');
  assert.equal(manager.rename(first.id, '  重要 对话  ').title, '重要 对话');
  assert.equal(manager.delete(second.id), true);
  assert.deepEqual(manager.getAll().map(item => item.id), [first.id]);
  assert.equal(manager.delete('missing'), false);
});

test('can store conversation records outside the config store', () => {
  let records = [];
  const manager = createConversationHistoryStore({
    getConversationRecords: () => records,
    setConversationRecords: (nextRecords) => {
      records = nextRecords;
    }
  });

  const saved = manager.upsert({
    title: '固定文件历史',
    updatedAt: '2026-05-28T08:00:00.000Z',
    messages: [{ question: '历史记录放哪里？', answer: '固定文件夹。' }]
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].id, saved.id);
  assert.equal(manager.get(saved.id).title, '固定文件历史');
  assert.equal(manager.delete(saved.id), true);
  assert.deepEqual(records, []);
});
