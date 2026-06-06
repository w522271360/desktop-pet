const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('app-server bridge script falls back to ws and forwards socket errors', () => {
  assert.match(mainSource, /const wsModulePath = JSON\.stringify\(require\.resolve\('ws'\)\);/);
  assert.match(mainSource, /const WebSocketImpl = globalThis\.WebSocket \|\| require\(\$\{wsModulePath\}\);/);
  assert.match(mainSource, /function getMessageText\(message\)/);
  assert.match(mainSource, /if \(Buffer\.isBuffer\(message\)\) return message\.toString\('utf8'\);/);
  assert.match(mainSource, /const text = getMessageText\(event\);/);
  assert.match(mainSource, /ws\.readyState !== WebSocketImpl\.OPEN/);
  assert.match(mainSource, /send\(\{ type: 'error', message \}\);/);
  assert.match(mainSource, /WebSocket closed \(\$\{code\}\)/);
});

test('bridge wait loop aborts on the first bridge error instead of timing out', () => {
  assert.match(mainSource, /let codexAppServerBridgeLastError = null;/);
  assert.match(mainSource, /if \(codexAppServerBridgeLastError\) \{/);
  assert.match(mainSource, /reject\(codexAppServerBridgeLastError\);/);
});

test('bridge process falls back to packaged Electron node mode when system node is unavailable', () => {
  assert.match(mainSource, /function resolveNodeRunner\(\)/);
  assert.match(mainSource, /command: process\.execPath,/);
  assert.match(mainSource, /ELECTRON_RUN_AS_NODE: '1'/);
  assert.match(mainSource, /childProcess\.spawn\(\s*nodeRunner\.command,/);
});

test('tls handshake failures produce actionable local ws guidance', () => {
  assert.match(mainSource, /function formatCodexAppServerConnectionError\(error, targetUrl\)/);
  assert.match(mainSource, /本地 app-server 通常应使用 ws:\/\/ 而不是 wss:\/\//);
  assert.match(mainSource, /ws:\/\/\$\{parsedUrl\.host\}/);
});

test('tls handshake failures mention certificates and reverse proxy for remote wss endpoints', () => {
  assert.match(mainSource, /请检查证书链、域名匹配和反向代理的 WebSocket TLS 配置/);
});
