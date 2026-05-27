const test = require('node:test');
const assert = require('node:assert/strict');

const { supportsVision } = require('../vision-capabilities');

const templates = {
  openai: {
    models: [
      { id: 'text-only', supportsVision: false },
      { id: 'vision', supportsVision: true }
    ]
  },
  custom: { models: [] }
};

test('allows visual requests for custom OpenAI-compatible endpoints', () => {
  assert.equal(
    supportsVision({ provider: 'custom', selectedModel: 'gpt-5.4' }, templates),
    true
  );
});

test('preserves explicit model capability checks for known providers', () => {
  assert.equal(
    supportsVision({ provider: 'openai', selectedModel: 'vision' }, templates),
    true
  );
  assert.equal(
    supportsVision({ provider: 'openai', selectedModel: 'text-only' }, templates),
    false
  );
});
