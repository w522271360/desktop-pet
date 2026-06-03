const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEEPSEEK_API_BASE = 'https://chat.deepseek.com/api';

const FAKE_HEADERS = {
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  Origin: 'https://chat.deepseek.com',
  Referer: 'https://chat.deepseek.com/',
  'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Chromium";v="148"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'X-App-Version': '2.0.0',
  'X-Client-Locale': 'zh_CN',
  'X-Client-Platform': 'web',
  'x-Client-Timezone-Offset': '28800',
  'X-Client-Version': '2.0.0',
};

const tokenCache = new Map();
const sessionCache = new Map();
let wasmInstance = null;
let cachedUint8Memory = null;
const cachedTextEncoder = new TextEncoder();

function unixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function maskToken(token) {
  const value = String(token || '');
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

function normalizeUserToken(rawToken) {
  const text = String(rawToken || '').trim();
  if (!text) return '';

  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') {
        return parsed.trim();
      }
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed.value || parsed.token || parsed.userToken || parsed.accessToken;
        if (typeof candidate === 'string') {
          return candidate.trim();
        }
      }
    } catch (error) {
      // Fall through to raw string handling.
    }
  }

  return text;
}

function appendDeepSeekLog(entry) {
  try {
    const store = require('./store');
    const logPath = path.join(store.dataDirectory, 'deepseek-plugin.log');
    const line = JSON.stringify({
      time: new Date().toISOString(),
      ...entry
    });
    fs.appendFileSync(logPath, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('[deepseek-plugin] failed to write log', error);
  }
}

function generateRandomString(length, charset = 'alphanumeric') {
  const sets = {
    numeric: '0123456789',
    alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    alphanumeric: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    hex: '0123456789abcdef',
  };
  const chars = sets[charset] || sets.alphanumeric;
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateCookie() {
  const timestamp = Date.now();
  return `intercom-HWWAFSESTIME=${timestamp}; HWWAFSESID=${generateRandomString(18, 'hex')}; Hm_lvt_${uuid()}=${Math.floor(timestamp / 1000)},${Math.floor(timestamp / 1000)},${Math.floor(timestamp / 1000)}; Hm_lpvt_${uuid()}=${Math.floor(timestamp / 1000)}; _frid=${uuid()}; _fr_ssid=${uuid()}; _fr_pvid=${uuid()}`;
}

function resolveDeepSeekModelType(model) {
  const value = String(model || '').trim().toLowerCase();
  if (!value) return 'default';
  if (value.includes('vision')) return 'vision';
  if (value.includes('pro') || value.includes('expert') || value.includes('r1')) return 'expert';
  return 'default';
}

async function loadWasm() {
  if (wasmInstance) return wasmInstance;
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sha3_wasm_bg.7b9ca65ddd.wasm')
    : path.join(app.getAppPath(), 'sha3_wasm_bg.7b9ca65ddd.wasm');
  const wasmBuffer = await fs.promises.readFile(wasmPath);
  const { instance } = await WebAssembly.instantiate(wasmBuffer, { wbg: {} });
  wasmInstance = instance.exports;
  return wasmInstance;
}

function getCachedUint8Memory() {
  if (cachedUint8Memory === null || cachedUint8Memory.byteLength === 0) {
    cachedUint8Memory = new Uint8Array(wasmInstance.memory.buffer);
  }
  return cachedUint8Memory;
}

function encodeString(text, allocate, reallocate) {
  if (!reallocate) {
    const encoded = cachedTextEncoder.encode(text);
    const ptr = allocate(encoded.length, 1) >>> 0;
    const memory = getCachedUint8Memory();
    memory.subarray(ptr, ptr + encoded.length).set(encoded);
    return { ptr, len: encoded.length };
  }

  const strLength = text.length;
  let ptr = allocate(strLength, 1) >>> 0;
  let memory = getCachedUint8Memory();
  let asciiLength = 0;

  for (; asciiLength < strLength; asciiLength += 1) {
    const charCode = text.charCodeAt(asciiLength);
    if (charCode > 127) break;
    memory[ptr + asciiLength] = charCode;
  }

  if (asciiLength !== strLength) {
    if (asciiLength > 0) text = text.slice(asciiLength);
    ptr = reallocate(ptr, strLength, asciiLength + text.length * 3, 1) >>> 0;
    memory = getCachedUint8Memory();
    const result = cachedTextEncoder.encodeInto(
      text,
      memory.subarray(ptr + asciiLength, ptr + asciiLength + text.length * 3)
    );
    asciiLength += result.written;
    ptr = reallocate(ptr, asciiLength + text.length * 3, asciiLength, 1) >>> 0;
  }

  return { ptr, len: asciiLength };
}

async function calculateChallengeAnswer(challenge) {
  if (!challenge || challenge.algorithm !== 'DeepSeekHashV1') {
    throw new Error('Unsupported DeepSeek challenge');
  }

  wasmInstance = await loadWasm();
  const prefix = `${challenge.salt}_${challenge.expire_at}_`;
  const retptr = wasmInstance.__wbindgen_add_to_stack_pointer(-16);
  try {
    const { ptr: ptr0, len: len0 } = encodeString(
      challenge.challenge,
      wasmInstance.__wbindgen_export_0,
      wasmInstance.__wbindgen_export_1
    );
    const { ptr: ptr1, len: len1 } = encodeString(
      prefix,
      wasmInstance.__wbindgen_export_0,
      wasmInstance.__wbindgen_export_1
    );
    wasmInstance.wasm_solve(retptr, ptr0, len0, ptr1, len1, challenge.difficulty);
    const dataView = new DataView(wasmInstance.memory.buffer);
    const status = dataView.getInt32(retptr + 0, true);
    const value = dataView.getFloat64(retptr + 8, true);
    if (status === 0 || value === undefined) {
      appendDeepSeekLog({
        stage: 'challenge-calculation-failed',
        challenge: {
          algorithm: challenge.algorithm,
          difficulty: challenge.difficulty,
          expire_at: challenge.expire_at
        },
        status,
        value
      });
      throw new Error('DeepSeek challenge calculation failed');
    }
    return Buffer.from(JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer: value,
      signature: challenge.signature,
      target_path: challenge.target_path || '/api/v0/chat/completion',
    })).toString('base64');
  } finally {
    wasmInstance.__wbindgen_add_to_stack_pointer(16);
  }
}

async function readStreamToString(stream) {
  return await new Promise((resolve, reject) => {
    let buffer = '';
    stream.on('data', chunk => {
      buffer += chunk.toString('utf8');
    });
    stream.on('end', () => resolve(buffer));
    stream.on('error', reject);
  });
}

async function readSseContent(stream) {
  return await new Promise((resolve, reject) => {
    let buffer = '';
    let content = '';
    let reasoning = '';
    let eventCount = 0;

    function flushEvent(rawEvent) {
      const lines = rawEvent
        .split('\n')
        .map(line => line.replace(/\r$/, ''))
        .filter(Boolean);
      const eventName = lines
        .filter(line => line.startsWith('event:'))
        .map(line => line.slice(6).trim())
        .find(Boolean) || 'message';
      const data = lines
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n')
        .trim();

      if (!data || data === '[DONE]') return;

      eventCount += 1;
      if (eventCount <= 8) {
        appendDeepSeekLog({
          stage: 'chat-completion-event',
          event: eventName,
          preview: data.slice(0, 500)
        });
      }

      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta || json?.choices?.[0]?.message || json;

        if (typeof delta?.reasoning_content === 'string') reasoning += delta.reasoning_content;
        if (typeof delta?.content === 'string') content += delta.content;

        const fragments = json?.v?.response?.fragments;
        if (Array.isArray(fragments)) {
          for (const fragment of fragments) {
            if (typeof fragment?.content === 'string') {
              content += fragment.content;
            }
          }
        }

        if (json?.o === 'APPEND' && typeof json?.v === 'string') {
          if (typeof json?.p === 'string' && /thinking|reasoning/i.test(json.p)) {
            reasoning += json.v;
          } else {
            content += json.v;
          }
        } else if (typeof json?.v === 'string' && !delta?.content && !delta?.reasoning_content) {
          content += json.v;
        }
      } catch {
        if (typeof data === 'string' && data) content += data;
      }
    }

    stream.on('data', chunk => {
      buffer += chunk.toString('utf8').replace(/\r\n/g, '\n');
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() || '';
      for (const part of parts) flushEvent(part);
    });
    stream.on('end', () => {
      if (buffer.trim()) flushEvent(buffer);
      resolve({
        content: sanitizeStreamText(content),
        reasoning: sanitizeStreamText(reasoning)
      });
    });
    stream.on('error', reject);
  });
}

function sanitizeStreamText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n?FINISHED\s*$/i, '')
    .replace(/\n?\[DONE\]\s*$/i, '')
    .trim();
}

class DeepSeekPluginService {
  getState() {
    const config = this.getStoredConfig();
    return {
      enabled: Boolean(config.enabled),
      hasToken: Boolean(config.token),
      accountLabel: config.accountLabel || '',
      lastLoginAt: config.lastLoginAt || null
    };
  }

  getStoredConfig() {
    const store = require('./store');
    return store.get('plugins', {}).deepseek || {};
  }

  updateStoredConfig(updates) {
    const store = require('./store');
    const plugins = store.get('plugins', {});
    plugins.deepseek = {
      enabled: false,
      token: '',
      accountLabel: '',
      lastLoginAt: null,
      ...(plugins.deepseek || {}),
      ...updates
    };
    store.set('plugins', plugins);
    return plugins.deepseek;
  }

  async captureTokenFromWindow(win) {
    if (!win || win.isDestroyed()) throw new Error('DeepSeek login window is not available');
    const token = await win.webContents.executeJavaScript(`
      (() => {
        try {
          return localStorage.getItem('userToken') || '';
        } catch (error) {
          return '';
        }
      })()
    `, true);
    return String(token || '').trim();
  }

  async saveToken(token) {
    const normalizedToken = normalizeUserToken(token);
    if (!normalizedToken) {
      throw new Error('请先粘贴 DeepSeek userToken');
    }
    const validation = await this.validateUserToken(normalizedToken);
    this.updateStoredConfig({
      enabled: true,
      token: normalizedToken,
      accountLabel: validation.accountLabel || 'DeepSeek Web',
      lastLoginAt: new Date().toISOString()
    });
    return this.getState();
  }

  async loginWithWindow(win) {
    const token = await this.captureTokenFromWindow(win);
    if (!token) throw new Error('未检测到 DeepSeek 登录信息，请先在网页里登录后再保存');
    return await this.saveToken(token);
  }

  clearAuth() {
    this.updateStoredConfig({
      enabled: false,
      token: '',
      accountLabel: '',
      lastLoginAt: null
    });
    tokenCache.clear();
    sessionCache.clear();
    return this.getState();
  }

  async validateUserToken(userToken) {
    const token = normalizeUserToken(userToken);
    if (!token) throw new Error('DeepSeek 插件尚未登录');

    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > unixTimestamp()) {
      return {
        accessToken: cached.accessToken,
        accountLabel: this.getStoredConfig().accountLabel || 'DeepSeek Web'
      };
    }

    const result = await axios.get(`${DEEPSEEK_API_BASE}/v0/users/current`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...FAKE_HEADERS,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (result.status === 401 || result.status === 403) {
      throw new Error('DeepSeek 登录已失效，请重新登录');
    }
    const businessCode = result.data?.code;
    const businessMessage = result.data?.msg || result.data?.message || '';

    if (result.status !== 200 || (businessCode !== undefined && businessCode !== 0)) {
      appendDeepSeekLog({
        stage: 'validate-user-token',
        status: result.status,
        token: maskToken(token),
        body: result.data
      });
      throw new Error(`DeepSeek token 验证失败：${businessMessage || `HTTP ${result.status}`}`);
    }

    const bizData = result.data?.data?.biz_data || result.data?.biz_data;
    const resolvedAccessToken =
      bizData?.token
      || result.data?.data?.token
      || result.data?.token
      || token;

    const resolvedAccountLabel =
      bizData?.user?.nickname
      || bizData?.user?.name
      || bizData?.nickname
      || bizData?.name
      || result.data?.data?.user?.nickname
      || result.data?.data?.user?.name
      || result.data?.data?.nickname
      || result.data?.data?.name
      || result.data?.user?.nickname
      || result.data?.user?.name
      || result.data?.nickname
      || result.data?.name
      || 'DeepSeek Web';

    tokenCache.set(token, {
      accessToken: resolvedAccessToken,
      refreshToken: token,
      expiresAt: unixTimestamp() + 3600,
    });
    appendDeepSeekLog({
      stage: 'validate-user-token',
      status: result.status,
      token: maskToken(token),
      resolvedAccessToken: maskToken(resolvedAccessToken),
      accountLabel: resolvedAccountLabel,
      body: result.data
    });
    return {
      accessToken: resolvedAccessToken,
      accountLabel: resolvedAccountLabel
    };
  }

  async acquireToken() {
    const stored = this.getStoredConfig();
    const validation = await this.validateUserToken(stored.token);
    return validation.accessToken;
  }

  async getAuthCandidates() {
    const stored = this.getStoredConfig();
    const originalToken = String(stored.token || '').trim();
    const accessToken = await this.acquireToken();
    return Array.from(new Set([accessToken, originalToken].filter(Boolean)));
  }

  async postWithTokenFallback(url, body, options = {}) {
    const candidates = await this.getAuthCandidates();
    let lastResponse = null;

    for (const token of candidates) {
      const response = await axios.post(url, body, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      lastResponse = response;
      const businessCode = response.data?.code;
      const businessMessage = String(response.data?.msg || response.data?.message || response.data?.data?.biz_msg || '');
      appendDeepSeekLog({
        stage: 'post-with-token-fallback',
        url,
        status: response.status,
        token: maskToken(token),
        body: response.data
      });
      if (response.status === 200 && (businessCode === undefined || businessCode === 0)) {
        return response;
      }

      const invalidToken = /invalid token|authorization failed|unauthorized/i.test(businessMessage);
      if (!invalidToken) {
        return response;
      }
    }

    return lastResponse;
  }

  async createSession() {
    const stored = this.getStoredConfig();
    const cacheKey = stored.token;
    const cached = sessionCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < 300000) return cached.sessionId;

    const result = await this.postWithTokenFallback(`${DEEPSEEK_API_BASE}/v0/chat_session/create`, {}, {
      headers: {
        ...FAKE_HEADERS,
        Cookie: generateCookie(),
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const bizData = result.data?.data?.biz_data || result.data?.biz_data;
    const sessionId = bizData?.chat_session?.id;
    if (result.status !== 200 || !sessionId) {
      const detail = result.data?.msg || result.data?.message || result.data?.data?.biz_msg || result.status;
      appendDeepSeekLog({
        stage: 'create-session-failed',
        status: result.status,
        body: result.data
      });
      throw new Error(`DeepSeek 会话创建失败：${detail}`);
    }

    sessionCache.set(cacheKey, { sessionId, createdAt: Date.now() });
    return sessionId;
  }

  messagesToPrompt(messages) {
    const markdownInstruction = '请始终使用 Markdown 回复。使用清晰的段落、列表、表格或代码块来组织内容；不要输出 HTML。若回答很短，也请保持 Markdown 文本格式。';
    const formattedMessages = (messages || [])
      .map(message => {
        if (message.role === 'assistant') {
          return `<｜Assistant｜>${String(message.content || '')}<｜end of sentence｜>`;
        }
        if (message.role === 'tool') {
          return `<｜User｜>${String(message.content || '')}`;
        }
        return `<｜User｜>${String(message.content || '')}`;
      });

    return [`<｜System｜>${markdownInstruction}<｜end of sentence｜>`, ...formattedMessages]
      .join('')
      .replace(/!\[.+\]\(.+\)/g, '');
  }

  async getChallenge(targetPath) {
    const result = await this.postWithTokenFallback(`${DEEPSEEK_API_BASE}/v0/chat/create_pow_challenge`, { target_path: targetPath }, {
      headers: {
        ...FAKE_HEADERS,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const bizData = result.data?.data?.biz_data || result.data?.biz_data;
    if (result.status !== 200 || !bizData?.challenge) {
      const detail = result.data?.msg || result.data?.message || result.data?.data?.biz_msg || result.status;
      appendDeepSeekLog({
        stage: 'get-challenge-failed',
        status: result.status,
        body: result.data
      });
      throw new Error(`DeepSeek Challenge 获取失败：${detail}`);
    }
    return bizData.challenge;
  }

  async chatCompletion(messages, model = 'deepseek-v4-flash') {
    const sessionId = await this.createSession();
    const prompt = this.messagesToPrompt(messages);
    const challenge = await this.getChallenge('/api/v0/chat/completion');
    const challengeAnswer = await calculateChallengeAnswer(challenge);
    const candidates = await this.getAuthCandidates();
    const modelType = resolveDeepSeekModelType(model);
    let response = null;

    for (const token of candidates) {
      response = await axios.post(`${DEEPSEEK_API_BASE}/v0/chat/completion`, {
      chat_session_id: sessionId,
      parent_message_id: null,
      prompt,
      model_type: modelType,
      ref_file_ids: [],
      search_enabled: false,
      thinking_enabled: false,
      preempt: false,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...FAKE_HEADERS,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
          Cookie: generateCookie(),
          'X-Ds-Pow-Response': challengeAnswer,
        },
        timeout: 120000,
        validateStatus: () => true,
        responseType: 'stream',
      });

      if (response.status < 400) {
        appendDeepSeekLog({
          stage: 'chat-completion-started',
          status: response.status,
          token: maskToken(token),
          sessionId,
          model,
          modelType
        });
        break;
      }

      let errorBody = null;
      try {
        if (response.data && typeof response.data.on === 'function') {
          errorBody = await readStreamToString(response.data);
        } else {
          errorBody = response.data;
        }
      } catch (error) {
        errorBody = `failed-to-read-error-body: ${error.message}`;
      }

      appendDeepSeekLog({
        stage: 'chat-completion-rejected',
        status: response.status,
        token: maskToken(token),
        sessionId,
        model,
        modelType,
        errorBody
      });
    }

    if (!response || response.status >= 400) {
      throw new Error(`DeepSeek 聊天失败：HTTP ${response.status}`);
    }

    return await readSseContent(response.data);
  }

  async testConnection() {
    const stored = this.getStoredConfig();
    await this.validateUserToken(stored.token);
    return { success: true, message: '✅ DeepSeek 插件登录可用' };
  }
}

module.exports = new DeepSeekPluginService();
