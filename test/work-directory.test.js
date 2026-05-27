const test = require('node:test');
const assert = require('node:assert/strict');

const { hasConfiguredWorkDirectory, workDirectoryRequiredError } = require('../work-directory');

test('requires an absolute configured work directory', () => {
  assert.equal(hasConfiguredWorkDirectory(''), false);
  assert.equal(hasConfiguredWorkDirectory('./workspace'), false);
  assert.equal(hasConfiguredWorkDirectory('/Users/example/project'), true);
});

test('provides a clear work directory requirement error', () => {
  assert.match(workDirectoryRequiredError(), /工作目录/);
  assert.match(workDirectoryRequiredError(), /设置/);
});
