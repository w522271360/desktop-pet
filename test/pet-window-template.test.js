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
  assert.match(source, /#pet-stage\s*\{[\s\S]*?align-items: flex-end;/);
  assert.match(source, /#pet-stage\s*\{[\s\S]*?justify-content: flex-end;/);
  assert.match(source, /#reminder-bubble\s*\{[\s\S]*?right: calc\(var\(--pet-size\) \+ var\(--pet-pad\) \+ 18px\);/);
  assert.match(source, /#reminder-bubble\s*\{[\s\S]*?top: 16px;/);
  assert.match(source, /#reminder-bubble::after\s*\{[\s\S]*?top: 46px;/);
  assert.match(source, /\.reminder-note\.show\s*\{[\s\S]*?display: block;/);
  assert.match(source, /#reminder-bubble\.network-bubble\s*\{[\s\S]*?right: calc\(var\(--pet-size\) \+ 8px\);/);
  assert.match(source, /#reminder-bubble\.network-bubble\s*\{[\s\S]*?bottom: calc\(var\(--pet-pad\) \+ \(var\(--pet-size\) \* 0\.58\)\);/);
  assert.match(source, /#reminder-bubble\.network-bubble\s*\{[\s\S]*?max-width: min\(168px, calc\(100vw - var\(--pet-size\) - 44px\)\);/);
  assert.match(source, /#reminder-bubble\.network-bubble \.reminder-actions\s*\{[\s\S]*?display: none;/);
  assert.match(source, /function truncateNetworkBubbleText\(text, limit = 20\)/);
  assert.match(source, /reminderTitle\.textContent = truncateNetworkBubbleText\(payload\.text, 20\);/);
  assert.match(source, /reminderTime\.textContent = `来自 \$\{source\}`;/);
  assert.match(source, /reminderBubble\.addEventListener\('click', \(event\) => \{/);
  assert.match(source, /petAPI\.openPetNetworkDetail\(activeNetworkBubble\);/);
  assert.match(source, /#context-menu\s*\{[\s\S]*?right: calc\(var\(--pet-size\) \+ var\(--pet-pad\) \+ 14px\);/);
  assert.match(source, /#context-menu\s*\{[\s\S]*?bottom: calc\(var\(--pet-pad\) \+ 8px\);/);
  assert.match(source, /petAPI\.controlPetWindow\('resize', \{[\s\S]*?anchor: 'bottom-right'[\s\S]*?\}\);/);
  assert.doesNotMatch(source, /contextMenu\.style\.left/);
  assert.doesNotMatch(source, /contextMenu\.style\.top/);
});
