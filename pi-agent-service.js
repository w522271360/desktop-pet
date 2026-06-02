const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Blob, File } = require('node:buffer');
const diagnosticsChannel = require('node:diagnostics_channel');
const workerThreads = require('node:worker_threads');
const store = require('./store');
const { resolveChatCompletionsUrl } = require('./openai-compatible');

let piSdkPromise = null;

function ensureTracingChannelCompatibility() {
  if (typeof diagnosticsChannel.tracingChannel === 'function') {
    return;
  }

  diagnosticsChannel.tracingChannel = function tracingChannel(name) {
    const start = diagnosticsChannel.channel(`tracing:${name}:start`);
    const end = diagnosticsChannel.channel(`tracing:${name}:end`);
    const asyncStart = diagnosticsChannel.channel(`tracing:${name}:asyncStart`);
    const asyncEnd = diagnosticsChannel.channel(`tracing:${name}:asyncEnd`);
    const error = diagnosticsChannel.channel(`tracing:${name}:error`);

    const publishIfNeeded = (channelRef, payload) => {
      if (channelRef.hasSubscribers) {
        channelRef.publish(payload);
      }
    };

    return {
      start,
      end,
      asyncStart,
      asyncEnd,
      error,
      subscribe(onMessage) {
        start.subscribe(onMessage);
        end.subscribe(onMessage);
        asyncStart.subscribe(onMessage);
        asyncEnd.subscribe(onMessage);
        error.subscribe(onMessage);
      },
      unsubscribe(onMessage) {
        start.unsubscribe(onMessage);
        end.unsubscribe(onMessage);
        asyncStart.unsubscribe(onMessage);
        asyncEnd.unsubscribe(onMessage);
        error.unsubscribe(onMessage);
      },
      get hasSubscribers() {
        return start.hasSubscribers
          || end.hasSubscribers
          || asyncStart.hasSubscribers
          || asyncEnd.hasSubscribers
          || error.hasSubscribers;
      },
      traceSync(fn, context = {}, thisArg, ...args) {
        publishIfNeeded(start, context);
        try {
          const result = fn.apply(thisArg, args);
          publishIfNeeded(end, context);
          return result;
        } catch (traceError) {
          publishIfNeeded(error, { ...context, error: traceError });
          throw traceError;
        }
      },
      tracePromise(fn, context = {}, thisArg, ...args) {
        publishIfNeeded(asyncStart, context);
        let promise;
        try {
          promise = Promise.resolve(fn.apply(thisArg, args));
        } catch (traceError) {
          publishIfNeeded(error, { ...context, error: traceError });
          return Promise.reject(traceError);
        }

        return promise.then(
          (result) => {
            publishIfNeeded(asyncEnd, context);
            return result;
          },
          (traceError) => {
            publishIfNeeded(error, { ...context, error: traceError });
            throw traceError;
          }
        );
      },
      traceCallback(fn, position = -1, context = {}, thisArg, ...args) {
        const callbackIndex = position < 0 ? args.length - 1 : position;
        const originalCallback = args[callbackIndex];

        if (typeof originalCallback !== 'function') {
          return this.traceSync(fn, context, thisArg, ...args);
        }

        args[callbackIndex] = (...callbackArgs) => {
          publishIfNeeded(asyncEnd, context);
          return originalCallback.apply(this, callbackArgs);
        };

        publishIfNeeded(asyncStart, context);
        try {
          return fn.apply(thisArg, args);
        } catch (traceError) {
          publishIfNeeded(error, { ...context, error: traceError });
          throw traceError;
        }
      }
    };
  };
}

ensureTracingChannelCompatibility();

function ensureWorkerThreadsCompatibility() {
  if (typeof workerThreads.markAsUncloneable === 'function') {
    return;
  }

  workerThreads.markAsUncloneable = function markAsUncloneable() {
    return undefined;
  };
}

ensureWorkerThreadsCompatibility();

function ensureWebPlatformCompatibility() {
  if (typeof globalThis.Blob === 'undefined' && typeof Blob !== 'undefined') {
    globalThis.Blob = Blob;
  }

  if (typeof globalThis.File === 'undefined' && typeof File !== 'undefined') {
    globalThis.File = File;
  }
}

ensureWebPlatformCompatibility();

function pathExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch (error) {
    return false;
  }
}

function readJson(targetPath) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function getPiRoot() {
  const packagedRoot = path.join(process.resourcesPath || '', 'pi');
  const devRoot = path.join(__dirname, 'third_party', 'pi');

  if (pathExists(path.join(packagedRoot, 'package.json'))) {
    return packagedRoot;
  }

  return devRoot;
}

function getPiPaths() {
  const root = getPiRoot();
  return {
    root,
    packagePath: path.join(root, 'package.json'),
    codingAgentPackagePath: path.join(root, 'packages', 'coding-agent', 'package.json'),
    nodeModulesPath: path.join(root, 'node_modules'),
    codingAgentDistIndex: path.join(root, 'packages', 'coding-agent', 'dist', 'index.js')
  };
}

function resolveOpenAIBaseUrl(apiUrl) {
  const completionsUrl = new URL(resolveChatCompletionsUrl(apiUrl));
  const normalizedPath = completionsUrl.pathname.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
  completionsUrl.pathname = normalizedPath || '/v1';
  return completionsUrl.toString().replace(/\/$/, '');
}

function sanitizeProviderName(name) {
  return String(name || 'desktop-pet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'desktop-pet';
}

function buildBootstrapInstructions() {
  return [
    'cd third_party/pi',
    'npm install --ignore-scripts',
    'npm run build'
  ];
}

async function loadPiSdk() {
  if (!piSdkPromise) {
    const { codingAgentDistIndex } = getPiPaths();
    piSdkPromise = import(pathToFileURL(codingAgentDistIndex).href);
  }
  return await piSdkPromise;
}

function formatTranscript(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return '';
  }

  const recentTurns = history.slice(-6);
  const transcript = recentTurns.map((item, index) => {
    const question = String(item?.question || '').trim();
    const answer = String(item?.answer || '').trim();
    return [
      `Turn ${index + 1} user: ${question}`,
      answer ? `Turn ${index + 1} assistant: ${answer}` : ''
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return transcript ? `Recent conversation context:\n${transcript}\n\n` : '';
}

function formatToolResultPreview(result) {
  if (typeof result === 'string') {
    return result;
  }

  if (result == null) {
    return '';
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return String(result);
  }
}

function extractAssistantText(messages = []) {
  const lastAssistant = [...messages].reverse().find(message => message?.role === 'assistant');
  if (!lastAssistant || !Array.isArray(lastAssistant.content)) {
    return '';
  }

  return lastAssistant.content
    .filter(block => block?.type === 'text')
    .map(block => block.text)
    .join('');
}

class PiAgentService {
  constructor() {
    this.activeSessions = new Map();
  }

  getStatus() {
    const piPaths = getPiPaths();
    const piPackage = readJson(piPaths.packagePath);
    const codingAgentPackage = readJson(piPaths.codingAgentPackagePath);
    const packaged = path.normalize(piPaths.root).startsWith(path.normalize(process.resourcesPath || ''));

    return {
      sourceRoot: piPaths.root,
      packaged,
      sourceVendored: pathExists(piPaths.root) && pathExists(piPaths.packagePath) && pathExists(piPaths.codingAgentPackagePath),
      packageName: piPackage?.name || null,
      packageVersion: piPackage?.version || null,
      codingAgentPackageName: codingAgentPackage?.name || null,
      codingAgentVersion: codingAgentPackage?.version || null,
      hasNodeModules: pathExists(piPaths.nodeModulesPath),
      hasBuiltSdk: pathExists(piPaths.codingAgentDistIndex),
      bootstrapCommands: packaged ? [] : buildBootstrapInstructions()
    };
  }

  async sendMessage({ prompt, cwd, history = [], onEvent = null, requestId = null }) {
    const status = this.getStatus();
    const cleanPrompt = String(prompt || '').trim();
    const activeConfig = store.getActiveConfig();

    if (!cleanPrompt) {
      return {
        success: false,
        error: 'Pi agent prompt is empty.',
        status
      };
    }

    if (!status.sourceVendored || !status.hasNodeModules || !status.hasBuiltSdk) {
      const packagedError = [
        'Pi runtime is missing from this packaged app.',
        '',
        `Expected runtime path: ${status.sourceRoot}`,
        'Please reinstall or replace this build with a package that includes the bundled Pi runtime.'
      ].join('\n');

      return {
        success: false,
        error: status.packaged
          ? packagedError
          : [
              'Pi runtime is not ready yet.',
              '',
              ...buildBootstrapInstructions().map(command => `- ${command}`)
            ].join('\n'),
        status
      };
    }

    if (!activeConfig || !activeConfig.apiUrl || !activeConfig.apiKey || !activeConfig.selectedModel) {
      return {
        success: false,
        error: 'No active API configuration is available for Pi agent mode.',
        status
      };
    }

    const providerName = `desktop-pet-${sanitizeProviderName(activeConfig.name || 'custom')}`;
    const requestedCwd = String(cwd || '').trim();
    const workdir = requestedCwd ? path.resolve(requestedCwd) : process.cwd();

    if (!pathExists(workdir)) {
      return {
        success: false,
        error: `Agent 工作目录不存在：${workdir}`,
        status
      };
    }

    try {
      if (!fs.statSync(workdir).isDirectory()) {
        return {
          success: false,
          error: `Agent 工作目录不是文件夹：${workdir}`,
          status
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `无法访问 Agent 工作目录：${workdir}`,
        status
      };
    }

    const model = {
      id: activeConfig.selectedModel,
      name: activeConfig.selectedModel,
      api: 'openai-completions',
      provider: providerName,
      baseUrl: resolveOpenAIBaseUrl(activeConfig.apiUrl),
      reasoning: true,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: 128000,
      maxTokens: 4000
    };

    const finalPrompt = [
      'You are running inside an Electron desktop pet app. Reply in Chinese.',
      'Format the final answer as clean Markdown when helpful.',
      'Prefer short headings, bullet lists, numbered steps, and fenced code blocks for commands or code.',
      'Avoid dumping one giant paragraph unless the user explicitly asks for it.',
      'Prefer using tools when they help inspect or change the local workspace.',
      '',
      formatTranscript(history),
      `Current user task:\n${cleanPrompt}`
    ].filter(Boolean).join('\n');

    let streamedText = '';
    let session = null;
    let aborted = false;
    const activeSessionKey = requestId ? String(requestId) : null;

    try {
      const piSdk = await loadPiSdk();
      const authStorage = piSdk.AuthStorage.inMemory();
      authStorage.setRuntimeApiKey(providerName, activeConfig.apiKey);
      const modelRegistry = piSdk.ModelRegistry.inMemory(authStorage);
      const sessionManager = piSdk.SessionManager.inMemory(workdir);
      const settingsManager = piSdk.SettingsManager.inMemory();

      const result = await piSdk.createAgentSession({
        cwd: workdir,
        model,
        authStorage,
        modelRegistry,
        sessionManager,
        settingsManager,
        tools: ['read', 'bash', 'edit', 'write', 'find', 'grep', 'ls']
      });

      session = result.session;
      if (activeSessionKey) {
        this.activeSessions.set(activeSessionKey, session);
      }
      onEvent?.({
        type: 'session-started'
      });

      session.subscribe((event) => {
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
          streamedText += event.assistantMessageEvent.delta;
          onEvent?.({
            type: 'text-delta',
            delta: event.assistantMessageEvent.delta
          });
        }
        if (event.type === 'tool_execution_start') {
          onEvent?.({
            type: 'tool-start',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args
          });
        }
        if (event.type === 'tool_execution_update') {
          onEvent?.({
            type: 'tool-update',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            partialResult: event.partialResult
          });
        }
        if (event.type === 'tool_execution_end') {
          onEvent?.({
            type: 'tool-end',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            isError: event.isError,
            result: formatToolResultPreview(event.result)
          });
        }
      });

      await session.prompt(finalPrompt);

      const assistantText = streamedText || extractAssistantText(session.state.messages);

      return {
        success: true,
        content: assistantText || 'Pi agent completed without text output.',
        model: activeConfig.selectedModel,
        status
      };
    } catch (error) {
      aborted = /abort/i.test(String(error?.message || ''));
      onEvent?.({
        type: aborted ? 'session-aborted' : 'session-error',
        error: error.message
      });
      return {
        success: false,
        error: aborted
          ? 'Pi agent execution was cancelled.'
          : `Pi agent execution failed: ${error.message}`,
        status
      };
    } finally {
      if (activeSessionKey) {
        this.activeSessions.delete(activeSessionKey);
      }
      try {
        session?.dispose();
      } catch (disposeError) {
        // Ignore transient cleanup failures.
      }
    }
  }

  async cancelMessage(requestId) {
    const key = String(requestId || '').trim();
    if (!key) {
      return { success: false, error: 'Missing Pi agent request id.' };
    }

    const session = this.activeSessions.get(key);
    if (!session) {
      return { success: false, error: 'Pi agent session was not found or already finished.' };
    }

    await session.abort();
    return { success: true };
  }
}

module.exports = new PiAgentService();
