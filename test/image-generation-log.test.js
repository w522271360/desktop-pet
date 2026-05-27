const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { appendImageGenerationLog } = require('../image-generation-log');

test('writes image request diagnostics beside app configuration without sensitive content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yuns-image-log-'));
  const storePath = path.join(directory, 'config.json');
  const logPath = appendImageGenerationLog(storePath, 'request-started', {
    endpoint: 'https://example.com/v1/images/generations',
    model: 'gpt-image-2',
    operation: 'generation',
    timeoutMs: 600000
  });

  const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());
  assert.equal(logPath, path.join(directory, 'image-generation.log'));
  assert.equal(entry.event, 'request-started');
  assert.equal(entry.model, 'gpt-image-2');
  assert.equal(entry.operation, 'generation');
  assert.equal(entry.endpoint, 'https://example.com/v1/images/generations');
  assert.equal(entry.prompt, undefined);
  assert.equal(entry.apiKey, undefined);
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
