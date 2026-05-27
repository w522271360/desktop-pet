const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { resolveConversationSavePath } = require('../conversation-save-path');

test('uses the user-selected Markdown directory when configured', () => {
  assert.equal(
    resolveConversationSavePath('/Users/example/Desktop/chats', '/Users/example/Documents'),
    '/Users/example/Desktop/chats'
  );
});

test('does not allow saving without a configured work directory', () => {
  assert.throws(
    () => resolveConversationSavePath('', '/Users/example/Documents'),
    /工作目录/
  );
});
