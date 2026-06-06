const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'codex-control.js'), 'utf8');

test('sending the first prompt clears the new session empty state', () => {
  assert.match(
    source,
    /querySelector\('\.empty-state, \.new-session-state'\)\) clearMessages\(\);/,
    'new-session placeholder must be removed before appending the first user message'
  );
});
