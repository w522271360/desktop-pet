const test = require('node:test');
const assert = require('node:assert/strict');

const { supportsVision } = require('../vision-capabilities');

test('allows visual requests for custom OpenAI-compatible endpoints', () => {
  assert.equal(
    supportsVision({ provider: 'custom', selectedModel: 'gpt-5.4' }),
    true
  );
});

test('does not block legacy provider values stored before provider cleanup', () => {
  assert.equal(
    supportsVision({ provider: 'openai', selectedModel: 'gpt-4o' }),
    true
  );
});
