function imageToDataUrl(image) {
  if (image.url) {
    return image.url;
  }

  return `data:${image.mimeType || 'image/png'};base64,${image.base64}`;
}

function getImageExtension(mimeType) {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  return 'png';
}

module.exports = { imageToDataUrl, getImageExtension };
