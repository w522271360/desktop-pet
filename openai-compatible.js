function resolveChatCompletionsUrl(apiUrl) {
  const url = new URL(apiUrl);
  const path = url.pathname.replace(/\/+$/, '');

  if (path.endsWith('/chat/completions')) {
    url.pathname = path;
  } else if (path.endsWith('/v1')) {
    url.pathname = `${path}/chat/completions`;
  } else {
    url.pathname = `${path}/v1/chat/completions`;
  }

  return url.toString().replace(/\/$/, '');
}

function resolveImagesUrl(apiUrl, operation) {
  const url = new URL(apiUrl);
  let path = url.pathname.replace(/\/+$/, '');

  path = path.replace(/\/v1\/(?:chat\/completions|images\/(?:generations|edits))$/, '/v1');
  if (!path.endsWith('/v1')) {
    path = `${path}/v1`;
  }

  url.pathname = `${path}/images/${operation}`;
  return url.toString().replace(/\/$/, '');
}

function extractChatCompletionMessage(data) {
  const message = data?.choices?.[0]?.message;

  if (!message) {
    throw new Error('API 响应格式不正确，请确认 API 地址指向 OpenAI 兼容的 /v1/chat/completions 接口。');
  }

  return message;
}

function extractChatCompletionContent(data) {
  const content = extractChatCompletionMessage(data).content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(part => part.text || '').join('');
  }

  throw new Error('API 响应中没有可显示的文本内容。');
}

function extractGeneratedImage(data) {
  const image = data?.data?.[0];
  if (image?.b64_json) {
    return { base64: image.b64_json, mimeType: 'image/png' };
  }
  if (image?.url) {
    return { url: image.url };
  }

  throw new Error('图片生成接口未返回图片，请确认当前 API Key 支持图片生成模型。');
}

module.exports = {
  resolveChatCompletionsUrl,
  resolveImagesUrl,
  extractChatCompletionMessage,
  extractChatCompletionContent,
  extractGeneratedImage
};
