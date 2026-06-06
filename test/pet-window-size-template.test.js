const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pet network bubble uses a compact expanded window', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

  assert.match(source, /function getPetWindowSize\(size = store\.get\('petSize', 'medium'\), expanded = false, variant = 'reminder'\)/);
  assert.match(source, /if \(variant === 'network'\) \{[\s\S]*?height: compact\.height \+ 66/);
  assert.match(source, /function showPetNetworkBubble\(payload\) \{[\s\S]*?resizePetWindowForReminder\(true, 'network'\);/);
  assert.match(source, /transparent: true,[\s\S]*?hasShadow: false,/);
});
