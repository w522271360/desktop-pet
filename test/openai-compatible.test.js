const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveChatCompletionsUrl,
  resolveImagesUrl,
  extractGeneratedImage,
  extractChatCompletionContent
} = require('../openai-compatible');

test('normalizes OpenAI-compatible base URLs to the chat completions endpoint', () => {
  assert.equal(
    resolveChatCompletionsUrl('https://tcdmx.com'),
    'https://tcdmx.com/v1/chat/completions'
  );
  assert.equal(
    resolveChatCompletionsUrl('https://example.com/v1/'),
    'https://example.com/v1/chat/completions'
  );
  assert.equal(
    resolveChatCompletionsUrl('https://example.com/v1/chat/completions'),
    'https://example.com/v1/chat/completions'
  );
});

test('extracts content from a standard compatible response', () => {
  assert.equal(
    extractChatCompletionContent({
      choices: [{ message: { content: 'hello' } }]
    }),
    'hello'
  );
});

test('rejects website or malformed responses with an actionable message', () => {
  assert.throws(
    () => extractChatCompletionContent('<html>site landing page</html>'),
    /API 地址/
  );
});

test('normalizes compatible image endpoints for generations and edits', () => {
  assert.equal(
    resolveImagesUrl('https://tcdmx.com', 'generations'),
    'https://tcdmx.com/v1/images/generations'
  );
  assert.equal(
    resolveImagesUrl('https://tcdmx.com/v1/chat/completions', 'edits'),
    'https://tcdmx.com/v1/images/edits'
  );
});

test('extracts base64 or URL image output', () => {
  assert.deepEqual(
    extractGeneratedImage({ data: [{ b64_json: 'abc' }] }),
    { base64: 'abc', mimeType: 'image/png' }
  );
  assert.deepEqual(
    extractGeneratedImage({ data: [{ url: 'https://example.com/image.png' }] }),
    { url: 'https://example.com/image.png' }
  );
});
