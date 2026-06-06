const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function mockElectron(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        getPath: () => __dirname
      }
    };
  }
  return originalLoad.apply(this, arguments);
};

const deepSeekPlugin = require('../deepseek-plugin');
Module._load = originalLoad;

const { sanitizeStreamText } = deepSeekPlugin.__test;

test('removes DeepSeek FINISHED stream trailer with event title', () => {
  assert.equal(
    sanitizeStreamText('主人好呀。\nFINISHED 小秘书问候主人'),
    '主人好呀。'
  );
});

test('preserves FINISHED inside normal response text', () => {
  assert.equal(
    sanitizeStreamText('The word FINISHED can appear in a sentence.'),
    'The word FINISHED can appear in a sentence.'
  );
});
