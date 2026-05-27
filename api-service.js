// 多配置 API 服务 - 支持最新模型、智能视觉分析和MCP工具调用
const axios = require('axios');
const config = require('./config');
const store = require('./store');
const { supportsVision } = require('./vision-capabilities');
const {
  resolveChatCompletionsUrl,
  resolveImagesUrl,
  extractChatCompletionMessage,
  extractChatCompletionContent,
  extractGeneratedImage
} = require('./openai-compatible');
const {
  IMAGE_GENERATION_MODEL,
  IMAGE_GENERATION_TIMEOUT_MS
} = require('./image-generation-config');
const { appendImageGenerationLog } = require('./image-generation-log');

// MCP客户端（延迟加载，避免循环依赖）
let mcpClient = null;
function getMcpClient() {
  if (!mcpClient) {
    mcpClient = require('./mcp-client');
  }
  return mcpClient;
}

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
  // 检查配置是否支持视觉
  checkVisionSupport(apiConfig) {
    return supportsVision(apiConfig, config.providerTemplates);
  }

  // 通用测试连接方法
  async testConnection(apiConfig) {
    const { provider, apiUrl, apiKey, selectedModel } = apiConfig;
    const template = config.providerTemplates[provider];
    
    if (!template) {
      return { success: false, error: '咦？这个提供商我还不认识呢 🤔\n\n试试选择 DeepSeek、Gemini 或 OpenAI 兼容的吧~' };
    }

    try {
      // Gemini 使用特殊的 API 格式
      if (provider === 'gemini') {
        return await this.testGemini(apiUrl, apiKey, selectedModel);
      }
      
      // Claude 使用 Anthropic API 格式
      if (provider === 'claude') {
        return await this.testClaude(apiUrl, apiKey, selectedModel);
      }
      
      // 其他所有供应商都使用 OpenAI 兼容格式
      // 包括: deepseek, openai, zhipu, moonshot, yi, siliconflow, groq, custom
      return await this.testOpenAICompatible(apiUrl, apiKey, selectedModel);
    } catch (error) {
      return { success: false, error: formatFriendlyError(error) };
    }
  }
  
  // 测试 Claude (Anthropic) API
  async testClaude(apiUrl, apiKey, model) {
    try {
      const response = await axios.post(
        apiUrl,
        {
          model: model,
          max_tokens: 10,
          messages: [{ role: 'user', content: '你好' }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 15000
        }
      );

      return {
        success: true,
        message: '✅ 耶！Claude 连接成功啦~ 可以开始对话了！',
        response: response.data
      };
    } catch (error) {
      logApiError('Claude API测试失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 测试 OpenAI 兼容 API（DeepSeek、OpenAI、自定义）
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

  // 测试 Gemini API
  async testGemini(apiUrl, apiKey, model) {
    try {
      const url = `${apiUrl}/${model}:generateContent?key=${apiKey}`;
      
      const response = await axios.post(
        url,
        {
          contents: [{
            role: 'user',
            parts: [{ text: '你好' }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
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
      logApiError('Gemini测试失败:', error);
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

  // 调用 Gemini API（支持视觉）
  async callGeminiWithVision(messages, base64Image, apiConfig, mimeType = 'image/png') {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    try {
      const url = `${apiUrl}/${selectedModel}:generateContent?key=${apiKey}`;
      
      const response = await axios.post(
        url,
        {
          contents: [{
            role: 'user',
            parts: [
              { text: messages[messages.length - 1].content },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image
                }
              }
            ]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        content: response.data.candidates[0].content.parts[0].text,
        model: `${name} (${selectedModel})`
      };
    } catch (error) {
      logApiError('Gemini视觉API调用失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 调用 Gemini API（普通对话）
  async callGemini(messages, apiConfig) {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    try {
      // 转换消息格式
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const url = `${apiUrl}/${selectedModel}:generateContent?key=${apiKey}`;
      
      const response = await axios.post(
        url,
        { contents },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        content: response.data.candidates[0].content.parts[0].text,
        model: `${name} (${selectedModel})`
      };
    } catch (error) {
      logApiError('Gemini调用失败:', error);
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
    
    if (!activeConfig || !activeConfig.apiKey) {
      return {
        success: false,
        error: '汪汪~ 还没配置 API 呢！\n\n去设置页面添加一个吧~ 🔧'
      };
    }

    // 检查是否支持视觉
    if (!this.checkVisionSupport(activeConfig)) {
      const template = config.providerTemplates[activeConfig.provider];
      const model = template?.models.find(m => m.id === activeConfig.selectedModel);
      
      // 查找该提供商下支持视觉的模型
      const visionModels = template?.models.filter(m => m.supportsVision);
      const visionModelNames = visionModels?.map(m => m.name).join('、');
      
      return {
        success: false,
        error: `🎨 当前模型 "${model?.name || activeConfig.selectedModel}" 还不会看图片呢~\n\n推荐试试这些支持视觉的模型：\n${visionModelNames || 'DeepSeek-V3.2 Chat、Gemini 2.5 Flash、GPT-4o'}\n\n💡 在设置中切换模型就可以啦！`
      };
    }

    const { provider } = activeConfig;
    
    // 构建分析消息
    const analysisMessage = [
      { 
        role: 'user', 
        content: prompt || '请分析这张图片，告诉我用户遇到了什么问题，或者画面里有什么？请用中文回答。'
      }
    ];
    
    try {
      if (provider === 'gemini') {
        return await this.callGeminiWithVision(analysisMessage, base64Image, activeConfig, mimeType);
      } else if (provider === 'claude') {
        return await this.callClaudeWithVision(analysisMessage, base64Image, activeConfig, mimeType);
      } else {
        // DeepSeek、OpenAI等使用OpenAI兼容格式
        return await this.callOpenAICompatibleWithVision(analysisMessage, base64Image, activeConfig, mimeType);
      }
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

    if (!activeConfig || !activeConfig.apiKey) {
      return {
        success: false,
        error: '还没有 API 密钥，无法生成图片。请先在设置中配置 API。'
      };
    }

    if (!['custom', 'openai'].includes(activeConfig.provider)) {
      return {
        success: false,
        error: '当前仅支持通过 OpenAI 兼容或自定义 API 配置生成图片。'
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
          error: `图片生成等待超过 ${IMAGE_GENERATION_TIMEOUT_MS / 60000} 分钟。已按 POST /v1/images/generations、model: ${imageModel} 发出请求，但中转站未在限时内返回图片，请稍后重试或检查该模型线路状态。`
        };
      }
      return {
        success: false,
        error: formatFriendlyError(error.response?.data?.error?.message || error.message)
      };
    }
  }
  
  // 调用 Claude API（支持视觉）
  async callClaudeWithVision(messages, base64Image, apiConfig, mimeType = 'image/png') {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    try {
      const response = await axios.post(
        apiUrl,
        {
          model: selectedModel,
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: messages[messages.length - 1].content
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image
                }
              }
            ]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 60000
        }
      );

      const content = response.data.content?.[0]?.text || '';
      
      return {
        success: true,
        content: content,
        model: `${name} (${selectedModel})`
      };
    } catch (error) {
      logApiError('Claude视觉API调用失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 发送消息（使用当前激活的配置，自动支持MCP工具）
  async sendMessage(messages, onToolCall = null) {
    const activeConfig = store.getActiveConfig();
    
    if (!activeConfig || !activeConfig.apiKey) {
      return {
        success: false,
        error: '汪~ 还没有 API 密钥呢！🔑\n\n去设置页面添加一个吧，我会等你回来的~'
      };
    }

    // 检查是否启用MCP
    const mcpEnabled = store.get('mcpEnabled', false);
    const { provider } = activeConfig;

    // 如果启用了MCP，使用工具调用
    if (mcpEnabled) {
      const mcp = getMcpClient();
      const tools = mcp.getToolsForAI();
      
      if (tools.length > 0) {
        // 添加系统提示，防止过度调用工具
        const messagesWithHint = this.addToolHint(messages);
        
        if (provider === 'gemini') {
          return await this.callGeminiWithTools(messagesWithHint, tools, activeConfig, onToolCall);
        } else if (provider === 'claude') {
          // Claude 暂不支持工具调用，使用普通对话
          return await this.callClaude(messages, activeConfig);
        } else {
          // 所有 OpenAI 兼容的供应商都支持工具调用
          return await this.callOpenAIWithTools(messagesWithHint, tools, activeConfig, onToolCall);
        }
      }
    }
    
    // 普通对话
    if (provider === 'gemini') {
      return await this.callGemini(messages, activeConfig);
    } else if (provider === 'claude') {
      return await this.callClaude(messages, activeConfig);
    } else {
      // 所有其他供应商使用 OpenAI 兼容格式
      return await this.callOpenAICompatible(messages, activeConfig);
    }
  }
  
  // 调用 Claude (Anthropic) API
  async callClaude(messages, apiConfig) {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    try {
      // 转换消息格式：提取 system 消息
      let systemPrompt = '';
      const claudeMessages = [];
      
      for (const msg of messages) {
        if (msg.role === 'system') {
          systemPrompt = msg.content;
        } else {
          claudeMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
      
      const requestBody = {
        model: selectedModel,
        max_tokens: 4096,
        messages: claudeMessages
      };
      
      // 如果有 system 消息，添加到请求中
      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }
      
      const response = await axios.post(
        apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 60000
        }
      );

      // Claude 响应格式不同
      const content = response.data.content?.[0]?.text || '';
      
      return {
        success: true,
        content: content,
        model: `${name} (${selectedModel})`
      };
    } catch (error) {
      logApiError('Claude API调用失败:', error);
      const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
      return {
        success: false,
        error: friendlyError
      };
    }
  }

  // 添加工具使用提示
  addToolHint(messages) {
    const systemHint = {
      role: 'system',
      content: `你是一个智能助手，可以使用工具来帮助用户。用中文回复。

【重要】工具使用规则（必须严格遵守）：
1. 每轮对话最多调用 1-2 个工具，然后必须给出回复
2. 工具调用失败或返回空结果时，直接告诉用户结果，绝不重试
3. 不要重复调用相同的工具和参数
4. 获取到信息后立即回复，不要继续查询

【新闻搜索工具注意事项】：
- 如果 search_news 返回 0 条结果，直接告诉用户"未找到相关新闻"
- 可以先用 list_news_sources 查看可用的新闻源
- 不要反复搜索同一个关键词

【浏览器工具注意事项】：
- puppeteer_evaluate 不支持 return 语句
- 元素找不到时不要重试，直接告诉用户`
    };

    // 检查是否已有系统消息
    if (messages.length > 0 && messages[0].role === 'system') {
      messages[0].content = systemHint.content + '\n\n' + messages[0].content;
      return messages;
    }

    return [systemHint, ...messages];
  }

  // ========== MCP 工具调用支持 ==========

  /**
   * 发送消息（支持MCP工具调用）
   * @param {Array} messages - 消息历史
   * @param {Function} onToolCall - 工具调用回调（用于UI显示）
   * @returns {Promise<Object>} - 响应结果
   */
  async sendMessageWithTools(messages, onToolCall = null) {
    const activeConfig = store.getActiveConfig();
    
    if (!activeConfig || !activeConfig.apiKey) {
      return {
        success: false,
        error: '汪~ 还没有 API 密钥呢！🔑\n\n去设置页面添加一个吧，我会等你回来的~'
      };
    }

    // 检查是否启用MCP
    const mcpEnabled = store.get('mcpEnabled', false);
    if (!mcpEnabled) {
      // 没有启用MCP，使用普通对话
      return await this.sendMessage(messages);
    }

    const mcp = getMcpClient();
    const tools = mcp.getToolsForAI();

    // 如果没有可用工具，使用普通对话
    if (tools.length === 0) {
      return await this.sendMessage(messages);
    }

    const { provider } = activeConfig;

    // 添加工具使用提示
    const messagesWithHint = this.addToolHint(messages);

    // 根据提供商选择不同的工具调用方式
    if (provider === 'gemini') {
      return await this.callGeminiWithTools(messagesWithHint, tools, activeConfig, onToolCall);
    } else if (provider === 'claude') {
      // Claude 暂不支持工具调用，使用普通对话
      return await this.callClaude(messages, activeConfig);
    } else {
      // 所有 OpenAI 兼容的供应商（deepseek, openai, zhipu, moonshot, yi, siliconflow, groq, custom）
      return await this.callOpenAIWithTools(messagesWithHint, tools, activeConfig, onToolCall);
    }
  }

  /**
   * 清理参数 schema，移除 Gemini 不支持的字段
   */
  cleanParametersForGemini(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }

    // 创建副本，避免修改原对象
    const cleaned = { ...params };

    // Gemini 不支持的字段
    const unsupportedFields = [
      '$schema', 
      'additionalProperties', 
      'exclusiveMinimum', 
      'exclusiveMaximum',
      '$id',
      '$ref',
      'definitions',
      'examples'
    ];

    // 删除不支持的字段
    for (const field of unsupportedFields) {
      delete cleaned[field];
    }

    // 递归清理 properties
    if (cleaned.properties && typeof cleaned.properties === 'object') {
      const cleanedProps = {};
      for (const [key, value] of Object.entries(cleaned.properties)) {
        cleanedProps[key] = this.cleanParametersForGemini(value);
      }
      cleaned.properties = cleanedProps;
    }

    // 递归清理 items (数组类型)
    if (cleaned.items) {
      cleaned.items = this.cleanParametersForGemini(cleaned.items);
    }

    return cleaned;
  }

  /**
   * 调用 Gemini API（带工具调用）
   * Gemini 的 Function Calling 格式与 OpenAI 不同
   */
  async callGeminiWithTools(messages, tools, apiConfig, onToolCall = null, maxIterations = 3) {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    // 转换 OpenAI 格式的 tools 到 Gemini 格式，并清理不支持的字段
    const geminiTools = [{
      function_declarations: tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description || `Tool: ${tool.function.name}`,
        parameters: this.cleanParametersForGemini(tool.function.parameters) || { type: 'object', properties: {} }
      }))
    }];

    // 转换消息格式
    let contents = messages
      .filter(msg => msg.role !== 'system') // Gemini 不支持 system role，需要特殊处理
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // 如果有 system 消息，添加到第一条用户消息前
    const systemMsg = messages.find(msg => msg.role === 'system');
    if (systemMsg && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `[系统指令]\n${systemMsg.content}\n\n[用户消息]\n${contents[0].parts[0].text}`;
    }

    let iteration = 0;
    let toolCallResults = [];

    while (iteration < maxIterations) {
      iteration++;

      try {
        const url = `${apiUrl}/${selectedModel}:generateContent?key=${apiKey}`;
        
        const requestBody = {
          contents,
          tools: geminiTools,
          tool_config: {
            function_calling_config: {
              mode: 'AUTO'
            }
          }
        };

        const response = await axios.post(url, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        });

        const candidate = response.data.candidates?.[0];
        if (!candidate) {
          return {
            success: false,
            error: 'Gemini 返回了空响应',
            toolCalls: toolCallResults
          };
        }

        const parts = candidate.content?.parts || [];
        
        // 检查是否有函数调用
        const functionCalls = parts.filter(part => part.functionCall);
        
        if (functionCalls.length > 0) {
          // 添加模型响应到对话历史
          contents.push({
            role: 'model',
            parts: parts
          });

          // 执行每个函数调用
          const functionResponses = [];
          
          for (const part of functionCalls) {
            const { name: toolName, args } = part.functionCall;

            // 回调通知UI
            if (onToolCall) {
              onToolCall({
                type: 'calling',
                toolName,
                args
              });
            }

            // 执行工具
            const mcp = getMcpClient();
            const result = await mcp.callTool(toolName, args);

            // 记录工具调用结果
            toolCallResults.push({
              toolName,
              args,
              result: result.result || result.error,
              success: result.success
            });

            // 回调通知UI
            if (onToolCall) {
              onToolCall({
                type: 'result',
                toolName,
                result: result.result || result.error,
                success: result.success
              });
            }

            // 添加函数响应
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: {
                  result: result.success ? result.result : `Error: ${result.error}`
                }
              }
            });
          }

          // 添加函数响应到对话历史
          contents.push({
            role: 'user',
            parts: functionResponses
          });

          // 继续循环，让AI处理工具结果
          continue;
        }

        // 没有函数调用，提取文本响应
        const textParts = parts.filter(part => part.text);
        const responseText = textParts.map(part => part.text).join('');

        return {
          success: true,
          content: responseText,
          model: `${name} (${selectedModel})`,
          toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined
        };

      } catch (error) {
        logApiError('Gemini 带工具调用的API请求失败:', error);
        const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
        return {
          success: false,
          error: friendlyError,
          toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined
        };
      }
    }

    // 达到最大迭代次数，让 AI 根据已有结果回答
    try {
      contents.push({
        role: 'user',
        parts: [{ text: '请根据以上工具返回的信息，给我一个总结性的回答。' }]
      });

      const url = `${apiUrl}/${selectedModel}:generateContent?key=${apiKey}`;
      
      const response = await axios.post(url, { contents }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        success: true,
        content: responseText,
        model: `${name} (${selectedModel})`,
        toolCalls: toolCallResults
      };
    } catch (error) {
      return {
        success: false,
        error: '🔄 工具调用遇到了问题~\n\n试试其他问题吧~',
        toolCalls: toolCallResults
      };
    }
  }

  /**
   * 调用OpenAI兼容API（带工具调用）
   * maxIterations 限制为3次，防止无限循环
   */
  async callOpenAIWithTools(messages, tools, apiConfig, onToolCall = null, maxIterations = 3) {
    const { apiUrl, apiKey, selectedModel, name } = apiConfig;
    
    let currentMessages = [...messages];
    let iteration = 0;
    let toolCallResults = [];

    while (iteration < maxIterations) {
      iteration++;

      try {
        const response = await axios.post(
          resolveChatCompletionsUrl(apiUrl),
          {
            model: selectedModel,
            messages: currentMessages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
            temperature: 0.7,
            max_tokens: 4000
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000 // 增加超时时间
          }
        );

        const message = extractChatCompletionMessage(response.data);

        // 检查是否有工具调用
        if (message.tool_calls && message.tool_calls.length > 0) {
          // 添加AI的工具调用请求到消息历史
          currentMessages.push({
            role: 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls
          });

          // 执行每个工具调用
          for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function.name;
            let args = {};
            
            try {
              args = JSON.parse(toolCall.function.arguments || '{}');
            } catch (e) {
              args = {};
            }

            // 回调通知UI
            if (onToolCall) {
              onToolCall({
                type: 'calling',
                toolName,
                args
              });
            }

            // 执行工具
            const mcp = getMcpClient();
            const result = await mcp.callTool(toolName, args);

            // 记录工具调用结果
            toolCallResults.push({
              toolName,
              args,
              result: result.result || result.error,
              success: result.success
            });

            // 回调通知UI
            if (onToolCall) {
              onToolCall({
                type: 'result',
                toolName,
                result: result.result || result.error,
                success: result.success
              });
            }

            // 添加工具调用结果到消息历史
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result.success ? result.result : `Error: ${result.error}`
            });
          }

          // 继续循环，让AI处理工具结果
          continue;
        }

        // 没有工具调用，返回最终结果
        return {
          success: true,
          content: message.content,
          model: `${name} (${selectedModel})`,
          toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined
        };

      } catch (error) {
        logApiError('带工具调用的API请求失败:', error);
        const friendlyError = formatFriendlyError(error.response?.data?.error?.message || error.message);
        return {
          success: false,
          error: friendlyError,
          toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined
        };
      }
    }

    // 达到最大迭代次数 - 直接让 AI 根据已有结果回答
    // 而不是返回错误
    try {
      // 添加一条系统消息，让 AI 根据已获取的信息直接回答
      currentMessages.push({
        role: 'system',
        content: '工具调用已达到上限。请根据目前已获取的信息，直接给用户一个总结性的回答。如果没有获取到有用信息，请告诉用户"抱歉，没有找到相关信息"。'
      });

      const response = await axios.post(
        resolveChatCompletionsUrl(apiUrl),
        {
          model: selectedModel,
          messages: currentMessages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        }
      );

      return {
        success: true,
        content: extractChatCompletionContent(response.data),
        model: `${name} (${selectedModel})`,
        toolCalls: toolCallResults
      };
    } catch (error) {
      // 如果最终请求也失败了，返回错误
      return {
        success: false,
        error: '🔄 工具调用遇到了问题~\n\n可能是新闻源暂时不可用，试试其他问题吧~',
        toolCalls: toolCallResults
      };
    }
  }
}

module.exports = new APIService();
