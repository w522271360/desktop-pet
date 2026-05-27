const test = require('node:test');
const assert = require('node:assert/strict');

const templatesConfig = require('../config/prompt-templates.json');

test('provides a quick template that routes requests to image generation', () => {
  const template = templatesConfig.templates.find(item => item.id === 'generate-image');

  assert.ok(template);
  assert.equal(template.name, '生成图片');
  assert.match(template.prompt, /生成一张\{\{text\}\}的图片/);
  assert.ok(templatesConfig.quickAccess.includes('generate-image'));
});
