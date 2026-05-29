const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveConversationSavePath } = require('../conversation-save-path');

test('stores exported conversation markdown beside app data', () => {
  assert.equal(
    resolveConversationSavePath('/Users/example/.desktop-pet'),
    '/Users/example/.desktop-pet'
  );
});
