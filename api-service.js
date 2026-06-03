// 多配置 API 服务 - 使用自定义 OpenAI 兼容接口
const axios = require('axios');
const store = require('./store');
const { supportsVision } = require('./vision-capabilities');
const deepseekPlugin = require('./deepseek-plugin');
const {
  resolveChatCompletionsUrl,
  resolveImagesUrl,
  extractChatCompletionContent,
  extractGeneratedImage
} = require('./openai-compatible');
const {
  IMAGE_GENERATION_MODEL,
  IMAGE_GENERATION_TIMEOUT_MS
} = require('./image-generation-config');
const { appendImageGenerationLog } = require('./image-generation-log');

// 友好的错误消息处理
function formatFriendlyError(error) {
  const errorStr = error.toString().toLowerCase();
  
  if (errorStr.includes('api key') || errorStr.includes('401')) {
    return '🔑 API 密钥好像不对呢~ 请检查一下配置~';
  }
  if (errorStr.includes('quota') || errorStr.includes('balance')) {
    return '💰 配额用完啦！需要充值或等待重置哦~';
  }
  if (errorStr.includes('rate limit') || errorStr.includes('429')) {
    return '🚦 请求太频繁啦，柴柴累了，休息一下再试吧~';
  }
  if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
    return '⏱️ 等待时间太长了，网络可能有点慢呢~';
  }
  if (errorStr.includes('econnreset') || errorStr.includes('socket disconnected')) {
    return '🌐 API 服务在建立连接时断开了请求。请检查 API 地址/模型名是否匹配，或稍后重试。';
  }
  if (errorStr.includes('network') || errorStr.includes('enotfound') || errorStr.includes('econnrefused')) {
    return '🌐 网络连接似乎有点问题，检查一下网络吧~';
  }
  if (errorStr.includes('403')) {
    return '🚫 没有访问权限哦~ 可能需要开通或升级服务~';
  }
  if (errorStr.includes('404')) {
    return '🔍 找不到这个地址呢，确认 API URL 是否正确~';
  }
  if (errorStr.includes('500') || errorStr.includes('502') || errorStr.includes('503')) {
    return '💥 服务器那边出了点问题，过会儿再试试吧~';
  }
  
  return `遇到了一点小问题：${error}`;
}

function sanitizeErrorForLog(error) {
  const safe = {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.response?.status,
    response: error.response?.data
  };

  if (error.config) {
    safe.request = {
      method: error.config.method,
      url: error.config.url,
      timeout: error.config.timeout,
      model: safeModelFromPayload(error.config.data)
    };
  }

  return safe;
}

function safeModelFromPayload(data) {
  try {
    const payload = typeof data === 'string' ? JSON.parse(data) : data;
    return payload?.model;
  } catch (error) {
    return undefined;
  }
}

function logApiError(label, error) {
  console.error(label, sanitizeErrorForLog(error));
}

class APIService {
  isDeepSeekPluginConfig(apiConfig) {
    return apiConfig?.sourceType === 'plugin_deepseek' || apiConfig?.pluginId === 'deepseek';
  }

  checkVisionSupport(apiConfig) {
    if (this.isDeepSeekPluginConfig(apiConfig)) {
      return false;
    }
    return supportsVision(apiConfig);
  }

  async testConnection(apiConfig) {
    try {
      if (this.isDeepSeekPluginConfig(apiConfig)) {
        return await deepseekPlugin.testConnection();
      }

      const { apiUrl, apiKey, selectedModel } = apiConfig;
      return await this.testOpenAICompatible(apiUrl, apiKey, selectedModel);
    } catch (error) {
      return { success: false, error: formatFriendlyError(error) };
    }
  }

  // 测试 OpenAI 兼容 API
  async testOpenAICompatible(apiUrl, apiKey, model) {
    try {
      const finalUrl = resolveChatCompletionsUrl(apiUrl);
      
      const response = await axios.post(
        finalUrl,
        {
          model: model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 15000
        }
      );

      return {
        success: true,
        message: '✅ 耶！连接成功啦~ 可以开始对话了！',
        response: response.data
      };
    } catch (error) {
      logApiError('API测试失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 调用 OpenAI 兼容 API（支持视觉）
  async callOpenAICompatibleWithVision(messages, base64Image, apiConfig, mimeType = 'image/png') {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    try {
      // 构建带图片的消息
      const visionMessages = [
        ...messages.slice(0, -1), // 之前的消息
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: messages[messages.length - 1].content
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ];

      const response = await axios.post(
        resolveChatCompletionsUrl(apiUrl),
        {
          model: selectedModel,
          messages: visionMessages,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      return {
        success: true,
        content: extractChatCompletionContent(response.data),
        model: `${name} (${selectedModel})`
      };
    } catch (error) {
      logApiError('视觉API调用失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 调用 OpenAI 兼容 API（普通对话）
  async callOpenAICompatible(messages, apiConfig) {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    try {
      const response = await axios.post(
        resolveChatCompletionsUrl(apiUrl),
        {
          model: selectedModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      return {
        success: true,
        content: extractChatCompletionContent(response.data),
        model: `${name} (${selectedModel})`
      };
    } catch (error) {
      logApiError('API调用失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 图片分析 - 使用当前激活的配置（支持截图和粘贴的图片）
  async analyzeImage(base64Image, prompt, mimeType = 'image/png') {
    const activeConfig = store.getActiveConfig();

    if (this.isDeepSeekPluginConfig(activeConfig)) {
      return {
        success: false,
        error: 'DeepSeek 插件当前只支持聊天，不支持图片分析。'
      };
    }
    
    if (!activeConfig || (!activeConfig.apiKey && !this.isDeepSeekPluginConfig(activeConfig))) {
      return {
        success: false,
        error: '汪汪~ 还没配置 API 呢！\n\n去设置页面添加一个吧~ 🔧'
      };
    }

    if (!this.checkVisionSupport(activeConfig)) {
      return {
        success: false,
        error: `🎨 当前模型 "${activeConfig.selectedModel}" 还不会看图片呢~\n\n请在自定义 API 中切换到支持视觉的模型。`
      };
    }

    const analysisMessage = [
      { 
        role: 'user', 
        content: prompt || '请分析这张图片，告诉我用户遇到了什么问题，或者画面里有什么？请用中文回答。'
      }
    ];
    
    try {
      return await this.callOpenAICompatibleWithVision(analysisMessage, base64Image, activeConfig, mimeType);
    } catch (error) {
      const friendlyError = formatFriendlyError(error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  async analyzeScreenshot(base64Image) {
    return await this.analyzeImage(
      base64Image,
      '请分析这张屏幕截图，告诉我用户遇到了什么问题，或者画面里有什么？请用中文回答。',
      'image/png'
    );
  }

  async generateImage(prompt, base64Image = null, mimeType = 'image/png') {
    const activeConfig = store.getActiveConfig();

    if (this.isDeepSeekPluginConfig(activeConfig)) {
      return {
        success: false,
        error: 'DeepSeek 插件当前只支持聊天，不支持图片生成。'
      };
    }

    if (!activeConfig || !activeConfig.apiKey) {
      return {
        success: false,
        error: '还没有 API 密钥，无法生成图片。请先在设置中配置 API。'
      };
    }

    const imageModel = IMAGE_GENERATION_MODEL;
    const operation = base64Image ? 'edit' : 'generation';
    const endpoint = resolveImagesUrl(activeConfig.apiUrl, base64Image ? 'edits' : 'generations');
    const startedAt = Date.now();
    appendImageGenerationLog(store.path, 'request-started', {
      endpoint,
      model: imageModel,
      operation,
      timeoutMs: IMAGE_GENERATION_TIMEOUT_MS
    });

    try {
      let response;
      if (base64Image) {
        const formData = new FormData();
        formData.append('model', imageModel);
        formData.append('prompt', prompt);
        formData.append('n', '1');
        formData.append('image', new Blob([Buffer.from(base64Image, 'base64')], { type: mimeType }), 'input-image');
        response = await axios.post(
          endpoint,
          formData,
          {
            headers: { Authorization: `Bearer ${activeConfig.apiKey}` },
            timeout: IMAGE_GENERATION_TIMEOUT_MS
          }
        );
      } else {
        response = await axios.post(
          endpoint,
          {
            model: imageModel,
            prompt,
            n: 1,
            size: '1024x1024'
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activeConfig.apiKey}`
            },
            timeout: IMAGE_GENERATION_TIMEOUT_MS
          }
        );
      }

      appendImageGenerationLog(store.path, 'response-received', {
        endpoint,
        model: imageModel,
        operation,
        durationMs: Date.now() - startedAt,
        status: response.status
      });
      return {
        success: true,
        image: extractGeneratedImage(response.data),
        model: imageModel
      };
    } catch (error) {
      logApiError('图片生成失败:', error);
      appendImageGenerationLog(store.path, 'request-failed', {
        endpoint,
        model: imageModel,
        operation,
        durationMs: Date.now() - startedAt,
        status: error.response?.status || null,
        code: error.code || null
      });
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: `图片生成等待超过 ${IMAGE_GENERATION_TIMEOUT_MS / 60000} 分钟。已按 POST /v1/images/generations、model: ${imageModel} 发出请求，但 API 服务未在限时内返回图片，请稍后重试或检查该模型线路状态。`
        };
      }
      return {
        success: false,
        error: formatFriendlyError(error.response?.data?.error?.message || error.message)
      };
    }
  }
  
  async sendMessage(messages) {
    const activeConfig = store.getActiveConfig();
    
    if (!activeConfig || (!activeConfig.apiKey && !this.isDeepSeekPluginConfig(activeConfig))) {
      return {
        success: false,
        error: '汪~ 还没有 API 密钥呢！🔑\n\n去设置页面添加一个吧，我会等你回来的~'
      };
    }

    if (this.isDeepSeekPluginConfig(activeConfig)) {
      try {
        const result = await deepseekPlugin.chatCompletion(messages, activeConfig.selectedModel || 'deepseek-v4-flash');
        return {
          success: true,
          content: result.content || result.reasoning || '',
          model: `${activeConfig.name || 'DeepSeek'} (${activeConfig.selectedModel || 'deepseek-v4-flash'})`
        };
      } catch (error) {
        return {
          success: false,
          error: formatFriendlyError(error.message)
        };
      }
    }

    return await this.callOpenAICompatible(messages, activeConfig);
  }

}

module.exports = new APIService();
