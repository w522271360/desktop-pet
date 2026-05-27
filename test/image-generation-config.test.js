const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IMAGE_GENERATION_MODEL,
  IMAGE_GENERATION_TIMEOUT_MS
} = require('../image-generation-config');

test('uses gpt-image-2 for generated and edited images', () => {
  assert.equal(IMAGE_GENERATION_MODEL, 'gpt-image-2');
});

test('allows the image endpoint enough time for queued generation', () => {
  assert.equal(IMAGE_GENERATION_TIMEOUT_MS, 10 * 60 * 1000);
});
