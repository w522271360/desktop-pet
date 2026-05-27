const test = require('node:test');
const assert = require('node:assert/strict');

const { requestsImageOutput } = require('../renderer/image-intent');

test('recognizes direct image generation and transformation requests', () => {
  assert.equal(requestsImageOutput('生成一张卡通图片'), true);
  assert.equal(requestsImageOutput('把这张照片转成日漫风'), true);
  assert.equal(requestsImageOutput('画一个海边日落'), true);
});

test('does not treat ordinary image questions as generation requests', () => {
  assert.equal(requestsImageOutput('这张图里有什么？'), false);
  assert.equal(requestsImageOutput('分析一下截图里的报错'), false);
});
