const test = require('node:test');
const assert = require('node:assert/strict');

const { findClipboardImage, parseImageDataUrl } = require('../renderer/image-attachment');

test('selects an image file from pasted clipboard items', () => {
  const textItem = { kind: 'string', type: 'text/plain' };
  const imageItem = { kind: 'file', type: 'image/png' };

  assert.equal(findClipboardImage([textItem, imageItem]), imageItem);
  assert.equal(findClipboardImage([textItem]), null);
});

test('parses a pasted image data URL for IPC transport', () => {
  assert.deepEqual(parseImageDataUrl('data:image/jpeg;base64,aGVsbG8='), {
    mimeType: 'image/jpeg',
    base64: 'aGVsbG8='
  });
});
