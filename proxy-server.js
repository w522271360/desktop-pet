// Gemini API 中转站服务 - 集成在 Electron 应用中
// 兼容 OpenAI API 格式，支持多 Key 自动切换
// 更新于 2025年12月 - 支持最新 Gemini 3 系列模型

const http = require('http');
const https = require('https');
const url = require('url');
const keyManager = require('./proxy-key-manager');
const store = require('./store');

class GeminiProxyServer {
  constructor() {
    this.server = null;
    this.port = 3001;
    this.isRunning = false;
    this.startTime = null;
    
    // 请求统计
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null
    };

    // 模型映射：全部使用免费模型
    // 免费模型: gemini-2.5-flash-lite, gemini-2.5-flash, gemini-3-flash
    this.modelMapping = {
      // ===== GPT 系列 -> 免费 Gemini =====
      'gpt-3.5-turbo': 'gemini-2.5-flash-lite',
      'gpt-4': 'gemini-2.5-flash',           // 免费
      'gpt-4-turbo': 'gemini-2.5-flash',     // 免费
      'gpt-4o': 'gemini-2.5-flash',          // 免费
      'gpt-4o-mini': 'gemini-2.5-flash-lite', // 免费
      'o1': 'gemini-2.5-flash',
      'o1-mini': 'gemini-2.5-flash-lite',
      'o3-mini': 'gemini-3-flash',
      
      // ===== Gemini 系列 (直接使用免费模型) =====
      'gemini-3-flash': 'gemini-3-flash',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-2.0-flash': 'gemini-2.5-flash',
      'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-1.5-flash': 'gemini-2.5-flash',
      'gemini-1.5-pro': 'gemini-2.5-flash',
      
      // ===== 别名 =====
      'gemini': 'gemini-2.5-flash',
      'gemini-pro': 'gemini-2.5-flash',
      'gemini-flash': 'gemini-2.5-flash'
    };

    // 默认模型（当请求的模型不在映射中时使用）
    this.defaultModel = 'gemini-2.5-flash';

    // 推理模型列表
    this.reasoningModels = [];
  }

  getProxyAgent() {
    return null;
  }

  /**
   * 启动服务器
   */
  start(geminiKeys, port = 3001) {
    if (this.isRunning) {
      console.log('⚠️ 中转站已在运行');
      return;
    }

    this.port = port;
    this.startTime = Date.now();
    
    // 初始化 Key 管理器
    keyManager.initialize(geminiKeys);

    if (keyManager.keys.length === 0) {
      console.log('⚠️ 没有可用的 Gemini Key，中转站未启动');
      return;
    }

    // 创建 HTTP 服务器
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // 明确监听 IPv4 地址，避免 IPv6 问题
    this.server.listen(this.port, '127.0.0.1', () => {
      this.isRunning = true;
      console.log(`
╔════════════════════════════════════════════════════════════╗
║         🚀 Gemini API 中转站已启动！                        ║
╠════════════════════════════════════════════════════════════╣
║  地址: http://127.0.0.1:${this.port}/v1                      
║  Gemini Keys: ${keyManager.getAvailableCount()} 个可用               
╠════════════════════════════════════════════════════════════╣
║  接口:                                                      ║
║  POST /v1/chat/completions - 聊天接口                       ║
║  GET  /v1/models           - 模型列表                       ║
║  GET  /status              - 状态查询                       ║
║  GET  /health              - 健康检查                       ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    this.server.on('error', (err) => {
      console.error('❌ 中转站启动失败:', err.message);
      this.isRunning = false;
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('👋 中转站已停止');
        this.isRunning = false;
        this.startTime = null;
      });
      keyManager.stop();
    }
  }

  /**
   * 重新加载 Keys
   */
  reloadKeys(geminiKeys) {
    keyManager.initialize(geminiKeys);
    console.log(`🔄 Key 池已更新，当前 ${keyManager.getAvailableCount()} 个可用`);
  }

  /**
   * 处理请求
   */
  async handleRequest(req, res) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;

    console.log(`📨 ${new Date().toISOString()} ${req.method} ${path}`);
    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();

    try {
      if (path === '/' || path === '/status') {
        this.handleStatus(res);
      } else if (path === '/health') {
        this.handleHealth(res);
      } else if (path === '/v1' || path === '/v1/') {
        // 兼容直接访问 /v1 的情况
        if (req.method === 'POST') {
          // POST 请求自动转发到 chat/completions
          await this.handleChatCompletions(req, res);
        } else {
          // GET 请求返回 API 信息
          this.handleApiInfo(res);
        }
      } else if (path === '/v1/models' || path === '/models') {
        this.handleModels(res);
      } else if ((path === '/v1/chat/completions' || path === '/chat/completions') && req.method === 'POST') {
        await this.handleChatCompletions(req, res);
      } else if (path === '/admin/keys') {
        this.handleAdminKeys(res);
      } else if (path === '/admin/stats') {
        this.handleAdminStats(res);
      } else {
        this.sendError(res, 404, '未找到路径: ' + path + '。可用路径: /v1/chat/completions, /v1/models, /status, /health');
      }
    } catch (error) {
      console.error('❌ 请求处理错误:', error);
      this.stats.failedRequests++;
      this.sendError(res, 500, error.message);
    }
  }

  /**
   * 状态接口
   */
  handleStatus(res) {
    const keyStatus = keyManager.getStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Gemini API 中转站',
      version: '2.0.0',
      port: this.port,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      keys: keyStatus,
      stats: this.stats
    }));
  }

  /**
   * 健康检查接口
   */
  handleHealth(res) {
    const keyStatus = keyManager.getStatus();
    const healthy = keyStatus.available > 0;
    
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      availableKeys: keyStatus.available,
      totalKeys: keyStatus.total,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    }));
  }

  /**
   * API 信息（兼容 /v1 路径）
   */
  handleApiInfo(res) {
    const keyStatus = keyManager.getStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Gemini API 中转站',
      version: '1.0.0',
      description: '兼容 OpenAI API 格式的 Gemini 代理服务',
      endpoints: {
        chat: '/v1/chat/completions',
        models: '/v1/models',
        status: '/status',
        health: '/health'
      },
      status: {
        running: true,
        availableKeys: keyStatus.available,
        totalKeys: keyStatus.total
      },
      usage: {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer <any-key>'
        },
        body: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      }
    }));
  }

  /**
   * 模型列表
   */
  handleModels(res) {
    const models = Object.keys(this.modelMapping).map(id => ({
      id,
      object: 'model',
      created: 1677610602,
      owned_by: 'google-gemini',
      // 添加模型能力标签
      capabilities: {
        vision: true,
        function_calling: true
      }
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: models }));
  }

  /**
   * 管理接口 - Keys 状态
   */
  handleAdminKeys(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(keyManager.getStatus()));
  }

  /**
   * 管理接口 - 统计信息
   */
  handleAdminStats(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...this.stats,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      successRate: this.stats.totalRequests > 0 
        ? Math.round((this.stats.successfulRequests / this.stats.totalRequests) * 100) 
        : 100
    }));
  }

  /**
   * Chat Completions 接口
   */
  async handleChatCompletions(req, res) {
    const body = await this.readBody(req);
    const openaiRequest = JSON.parse(body);

    const { stream = false, model = 'gemini-2.5-flash' } = openaiRequest;
    const geminiModel = this.modelMapping[model] || this.defaultModel;
    const isReasoningModel = this.reasoningModels.includes(geminiModel);

    console.log(`🤖 请求: model=${model} -> ${geminiModel}, stream=${stream}${isReasoningModel ? ' (推理模式)' : ''}`);

    // 获取可用的 Key 并尝试请求
    let keyObj = keyManager.getNextKey();
    let lastError = null;
    let attempts = 0;
    const maxRetries = 3;

    while (keyObj && attempts < maxRetries) {
      try {
        if (stream) {
          await this.proxyGeminiStream(openaiRequest, geminiModel, keyObj, res);
        } else {
          await this.proxyGemini(openaiRequest, geminiModel, keyObj, res);
        }
        keyManager.reportSuccess(keyObj);
        this.stats.successfulRequests++;
        return;
      } catch (error) {
        lastError = error;
        keyManager.reportFailure(keyObj, error);
        keyObj = keyManager.getNextKey();
        attempts++;
        if (keyObj) {
          console.log(`🔄 切换到 Key #${keyObj.index + 1} 重试...`);
        }
      }
    }

    // 所有重试都失败
    this.stats.failedRequests++;
    this.sendError(res, 500, lastError?.message || '所有 API Key 都不可用');
  }

  /**
   * 代理到 Gemini（非流式）
   */
  proxyGemini(openaiRequest, geminiModel, keyObj, res) {
    return new Promise((resolve, reject) => {
      const contents = this.convertToGeminiMessages(openaiRequest.messages);
      const proxyAgent = this.getProxyAgent();
      
      const geminiRequest = JSON.stringify({
        contents,
        generationConfig: {
          temperature: openaiRequest.temperature ?? 0.7,
          maxOutputTokens: openaiRequest.max_tokens ?? 8192,
          topP: openaiRequest.top_p ?? 0.95
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/${geminiModel}:generateContent?key=${keyObj.key}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(geminiRequest)
        },
        agent: proxyAgent,
        timeout: 60000
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          try {
            if (proxyRes.statusCode !== 200) {
              reject(new Error(`Gemini API 错误: ${proxyRes.statusCode} - ${data}`));
              return;
            }

            const geminiResponse = JSON.parse(data);
            const openaiResponse = this.convertFromGeminiResponse(geminiResponse, openaiRequest.model);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(openaiResponse));
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      proxyReq.on('error', reject);
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        reject(new Error('请求超时'));
      });
      proxyReq.write(geminiRequest);
      proxyReq.end();
    });
  }

  /**
   * 代理到 Gemini（流式）
   */
  proxyGeminiStream(openaiRequest, geminiModel, keyObj, res) {
    return new Promise((resolve, reject) => {
      const contents = this.convertToGeminiMessages(openaiRequest.messages);
      const proxyAgent = this.getProxyAgent();
      
      const geminiRequest = JSON.stringify({
        contents,
        generationConfig: {
          temperature: openaiRequest.temperature ?? 0.7,
          maxOutputTokens: openaiRequest.max_tokens ?? 8192,
          topP: openaiRequest.top_p ?? 0.95
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${keyObj.key}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(geminiRequest)
        },
        agent: proxyAgent,
        timeout: 120000  // 流式响应需要更长超时
      };

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const requestId = `chatcmpl-${Date.now()}`;

      const proxyReq = https.request(options, (proxyRes) => {
        let buffer = '';

        proxyRes.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                res.write('data: [DONE]\n\n');
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                
                if (text) {
                  const chunk = {
                    id: requestId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: openaiRequest.model,
                    choices: [{
                      index: 0,
                      delta: { content: text },
                      finish_reason: null
                    }]
                  };
                  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }

                if (parsed.candidates?.[0]?.finishReason) {
                  const finalChunk = {
                    id: requestId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: openaiRequest.model,
                    choices: [{
                      index: 0,
                      delta: {},
                      finish_reason: 'stop'
                    }]
                  };
                  res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        });

        proxyRes.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
          resolve();
        });

        proxyRes.on('error', reject);
      });

      proxyReq.on('error', (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        reject(err);
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.write(`data: ${JSON.stringify({ error: '请求超时' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        reject(new Error('请求超时'));
      });

      proxyReq.write(geminiRequest);
      proxyReq.end();
    });
  }

  /**
   * 转换为 Gemini 消息格式
   */
  convertToGeminiMessages(openaiMessages) {
    const contents = [];
    let systemPrompt = '';

    for (const msg of openaiMessages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
      } else if (msg.role === 'user') {
        // 处理多模态消息
        if (Array.isArray(msg.content)) {
          const parts = [];
          for (const item of msg.content) {
            if (item.type === 'text') {
              parts.push({ text: item.text });
            } else if (item.type === 'image_url') {
              // 处理图片
              const imageUrl = item.image_url.url;
              if (imageUrl.startsWith('data:')) {
                // Base64 图片
                const [header, data] = imageUrl.split(',');
                const mimeType = header.match(/data:(.+);/)?.[1] || 'image/png';
                parts.push({
                  inline_data: {
                    mime_type: mimeType,
                    data: data
                  }
                });
              }
            }
          }
          contents.push({ role: 'user', parts });
        } else {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        }
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    // System prompt 合并到第一条 user 消息
    if (systemPrompt && contents.length > 0 && contents[0].role === 'user') {
      const firstPart = contents[0].parts[0];
      if (firstPart.text) {
        firstPart.text = `[System]\n${systemPrompt}\n\n[User]\n${firstPart.text}`;
      }
    }

    return contents;
  }

  /**
   * 转换 Gemini 响应为 OpenAI 格式
   */
  convertFromGeminiResponse(geminiResponse, model) {
    const text = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = geminiResponse.usageMetadata || {};
    
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: usageMetadata.promptTokenCount || 0,
        completion_tokens: usageMetadata.candidatesTokenCount || 0,
        total_tokens: usageMetadata.totalTokenCount || 0
      }
    };
  }

  /**
   * 读取请求体
   */
  readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * 发送错误响应
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        message,
        type: 'api_error',
        code: statusCode
      }
    }));
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.port,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      stats: this.stats,
      keys: keyManager.getStatus()
    };
  }

  /**
   * 测试连接
   */
  async testConnection() {
    const keyObj = keyManager.keys[0];
    if (!keyObj) {
      return { success: false, error: '没有可用的 API Key' };
    }

    const proxyAgent = this.getProxyAgent();
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models?key=${keyObj.key}`,
        method: 'GET',
        agent: proxyAgent,
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          if (res.statusCode === 200) {
            resolve({
              success: true,
              responseTime,
              message: `连接成功 (${responseTime}ms)${proxyAgent ? ' [通过代理]' : ''}`
            });
          } else {
            let errorMsg = '未知错误';
            try {
              const parsed = JSON.parse(data);
              errorMsg = parsed.error?.message || `HTTP ${res.statusCode}`;
            } catch {
              errorMsg = `HTTP ${res.statusCode}`;
            }
            resolve({
              success: false,
              responseTime,
              error: errorMsg
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: `连接失败: ${err.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: '连接超时'
        });
      });

      req.end();
    });
  }

  /**
   * 获取 Key 管理器
   */
  getKeyManager() {
    return keyManager;
  }
}

module.exports = new GeminiProxyServer();
