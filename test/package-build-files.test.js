const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');

test('packages main-process helpers required at app startup', () => {
  assert.ok(
    packageJson.build.files.includes('config-change-notifier.js'),
    'config-change-notifier.js must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('vision-capabilities.js'),
    'vision-capabilities.js must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('openai-compatible.js'),
    'openai-compatible.js must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('generated-image-export.js'),
    'generated-image-export.js must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('conversation-history.js'),
    'conversation-history.js must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('conversation-save-path.js'),
    'conversation-save-path.js must be included in packaged desktop builds'
  );
  assert.ok(packageJson.build.files.includes('image-generation-config.js'));
  assert.ok(packageJson.build.files.includes('image-generation-log.js'));
  assert.ok(packageJson.build.files.includes('reminder-manager.js'));
  assert.ok(packageJson.build.files.includes('portable-restart.js'));
  assert.ok(packageJson.build.files.includes('pet-device-identity.js'));
  assert.ok(packageJson.build.files.includes('pet-network-client.js'));
  assert.ok(packageJson.build.files.includes('pet-network-protocol.js'));
  assert.ok(packageJson.build.files.includes('pet-server.js'));
  assert.ok(
    packageJson.build.files.includes('preload.js'),
    'preload bridge must be included so packaged settings can control launch-at-login'
  );
  assert.ok(
    packageJson.build.files.includes('config/prompt-templates.json'),
    'prompt templates must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('assets/bubu/**/*'),
    'bubu pet spritesheet must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('assets/yier/**/*'),
    'yier pet spritesheet must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('renderer/**/*'),
    'screenshot selector and renderer assets must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('assets/icon.ico'),
    'Windows app icon must be included in packaged desktop builds'
  );
  assert.ok(
    packageJson.build.files.includes('assets/icon.icns'),
    'macOS app icon must be included in packaged desktop builds'
  );
  assert.equal(packageJson.build.win.icon, 'assets/icon.ico');
  assert.equal(packageJson.build.mac.icon, 'assets/icon.icns');
  assert.equal(packageJson.build.productName, '桌面小助手');
  assert.equal(packageJson.productName, '桌面小助手');
});
