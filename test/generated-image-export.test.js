const test = require('node:test');
const assert = require('node:assert/strict');

const { imageToDataUrl, getImageExtension } = require('../generated-image-export');

test('creates a displayable data URL from generated base64 output', () => {
  assert.equal(
    imageToDataUrl({ base64: 'abc', mimeType: 'image/jpeg' }),
    'data:image/jpeg;base64,abc'
  );
});

test('preserves generated remote URLs and derives output extension', () => {
  assert.equal(
    imageToDataUrl({ url: 'https://example.com/image.webp' }),
    'https://example.com/image.webp'
  );
  assert.equal(getImageExtension('image/jpeg'), 'jpg');
  assert.equal(getImageExtension('image/png'), 'png');
});
