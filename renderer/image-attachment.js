(function initializeImageAttachment(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ImageAttachment = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createImageAttachmentApi() {
  function findClipboardImage(items) {
    return Array.from(items || []).find(item => (
      item.kind === 'file' && item.type.startsWith('image/')
    )) || null;
  }

  function parseImageDataUrl(dataUrl) {
    const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) {
      return null;
    }

    return {
      mimeType: match[1],
      base64: match[2]
    };
  }

  return { findClipboardImage, parseImageDataUrl };
});
