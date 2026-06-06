const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pet window renderer keeps live template expressions', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'pet.html'), 'utf8');

  assert.doesNotMatch(source, /\\\$\{/);
  assert.match(source, /let animationTimer = null;/);
  assert.match(source, /petSprite\.style\.backgroundPosition = `\$\{/);
  assert.match(source, /style\.setProperty\('--pet-size', `\$\{/);
  assert.match(source, /#pet-stage\s*\{[\s\S]*?justify-content: flex-end;/);
  assert.match(source, /#reminder-bubble\s*\{[\s\S]*?right: calc\(var\(--pet-size\) \+ var\(--pet-pad\) \+ 18px\);/);
  assert.match(source, /#reminder-bubble\s*\{[\s\S]*?top: 16px;/);
  assert.match(source, /#reminder-bubble::after\s*\{[\s\S]*?top: 46px;/);
});
