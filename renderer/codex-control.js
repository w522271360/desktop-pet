(function () {
  const SOURCE_KINDS = [
    'cli',
    'vscode',
    'appServer',
    'exec',
    'subAgent',
    'subAgentReview',
    'subAgentCompact',
    'subAgentThreadSpawn',
    'subAgentOther',
    'unknown'
  ];

  const state = {
    config: null,
    connected: false,
    connecting: false,
    threads: [],
    models: [],
    selectedThreadId: null,
    selectedCwd: '',
    selectedModel: '',
    activeTurnId: null,
    itemNodes: new Map(),
    resumedThreads: new Set(),
    newThreadMode: true
  };

  const els = {
    statusDot: document.getElementById('status-dot'),
    statusTitle: document.getElementById('status-title'),
    statusDetail: document.getElementById('status-detail'),
    connectBtn: document.getElementById('connect-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    newThreadBtn: document.getElementById('new-thread-btn'),
    threadSearch: document.getElementById('thread-search'),
    threadList: document.getElementById('thread-list'),
    threadTitle: document.getElementById('thread-title'),
    threadMeta: document.getElementById('thread-meta'),
    messages: document.getElementById('messages'),
    composer: document.getElementById('composer'),
    promptInput: document.getElementById('prompt-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    cwdInput: document.getElementById('cwd-input'),
    cwdOptions: document.getElementById('cwd-options'),
    modelSelect: document.getElementById('model-select')
  };

  function setStatus(kind, title, detail) {
    els.statusDot.classList.toggle('connected', kind === 'connected');
    els.statusDot.classList.toggle('error', kind === 'error');
    els.statusTitle.textContent = title;
    els.statusDetail.textContent = detail || '';
  }

  function setBusy(isBusy) {
    els.sendBtn.disabled = !state.connected || isBusy;
    els.promptInput.disabled = !state.connected || isBusy;
    els.cwdInput.disabled = !state.connected || isBusy;
    els.modelSelect.disabled = !state.connected || isBusy;
    els.stopBtn.classList.toggle('hidden', !isBusy);
  }

  function escapeText(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function formatTime(value) {
    if (!value) return '';
    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalizeCwd(cwd) {
    return String(cwd || '').trim();
  }

  function projectNameFromCwd(cwd) {
    const normalized = normalizeCwd(cwd);
    if (!normalized) return '项目';
    const cleaned = normalized.replace(/[\\/]+$/, '');
    const parts = cleaned.split(/[\\/]+/).filter(Boolean);
    return parts[parts.length - 1] || cleaned || '项目';
  }

  function getThreadTitle(thread) {
    return thread?.name || thread?.preview || thread?.id || '未命名会话';
  }

  function getThreadPreview(thread) {
    return thread?.preview || thread?.cwd || thread?.id || '';
  }

  function uniqueCwds() {
    return Array.from(new Set(state.threads.map((thread) => normalizeCwd(thread.cwd)).filter(Boolean)));
  }

  function updateCwdOptions() {
    els.cwdOptions.innerHTML = uniqueCwds()
      .map((cwd) => `<option value="${escapeText(cwd)}">${escapeText(projectNameFromCwd(cwd))}</option>`)
      .join('');
  }

  function getActiveProjectName() {
    return projectNameFromCwd(state.selectedCwd || els.cwdInput.value || uniqueCwds()[0] || '');
  }

  function renderEmptyPrompt() {
    clearMessages();
    const projectName = getActiveProjectName();
    els.messages.innerHTML = `
      <div class="empty-state">
        <strong>我们应该在 ${escapeText(projectName)} 中构建什么？</strong>
        <span>选择已有项目，或在下方输入一个远程工作目录；发送第一条消息时会创建新会话。</span>
      </div>
    `;
  }

  function setHeaderForNewThread() {
    const cwd = normalizeCwd(els.cwdInput.value || state.selectedCwd);
    els.threadTitle.textContent = `新会话 · ${projectNameFromCwd(cwd)}`;
    els.threadMeta.textContent = cwd || '输入或选择远程项目目录';
  }

  function enterNewThreadMode(cwd = state.selectedCwd) {
    state.selectedThreadId = null;
    state.newThreadMode = true;
    state.selectedCwd = normalizeCwd(cwd);
    els.cwdInput.value = state.selectedCwd;
    setHeaderForNewThread();
    renderThreads();
    renderEmptyPrompt();
    setBusy(false);
    els.promptInput.focus();
  }

  function groupThreads(threads) {
    const groups = new Map();
    threads.forEach((thread) => {
      const cwd = normalizeCwd(thread.cwd);
      const key = cwd || '__uncategorized__';
      if (!groups.has(key)) {
        groups.set(key, {
          cwd,
          name: cwd ? projectNameFromCwd(cwd) : '无项目目录',
          threads: []
        });
      }
      groups.get(key).threads.push(thread);
    });
    return Array.from(groups.values());
  }

  function renderThreads() {
    const query = els.threadSearch.value.trim().toLowerCase();
    const threads = state.threads.filter((thread) => {
      const haystack = `${getThreadTitle(thread)} ${getThreadPreview(thread)} ${thread.cwd || ''}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    if (!threads.length) {
      els.threadList.innerHTML = '<div class="empty-state"><strong>没有会话</strong><span>连接后会按项目列出 app-server 返回的历史。</span></div>';
      return;
    }

    els.threadList.innerHTML = groupThreads(threads).map((group) => `
      <section class="project-group">
        <button class="project-header ${normalizeCwd(group.cwd) === normalizeCwd(state.selectedCwd) && state.newThreadMode ? 'active' : ''}" type="button" data-cwd="${escapeText(group.cwd)}">
          <span class="project-icon">⌁</span>
          <span class="project-name">${escapeText(group.name)}</span>
          <span class="project-count">${group.threads.length}</span>
        </button>
        ${group.threads.map((thread) => `
          <button class="thread-item ${thread.id === state.selectedThreadId ? 'active' : ''}" type="button" data-thread-id="${escapeText(thread.id)}">
            <span class="thread-name">${escapeText(getThreadTitle(thread))}</span>
            <span class="thread-preview">${escapeText(getThreadPreview(thread))}</span>
            <span class="thread-time">${escapeText(formatTime(thread.updatedAt || thread.createdAt))}</span>
          </button>
        `).join('')}
      </section>
    `).join('');
  }

  function renderModels() {
    if (!state.models.length) {
      els.modelSelect.innerHTML = '<option value="gpt-5.4">gpt-5.4</option>';
      state.selectedModel = state.selectedModel || 'gpt-5.4';
      els.modelSelect.value = state.selectedModel;
      return;
    }

    els.modelSelect.innerHTML = state.models.map((model) => `
      <option value="${escapeText(model.model || model.id)}">${escapeText(model.displayName || model.model || model.id)}</option>
    `).join('');

    const defaultModel = state.models.find((model) => model.isDefault) || state.models[0];
    state.selectedModel = state.selectedModel || defaultModel?.model || defaultModel?.id || '';
    els.modelSelect.value = state.selectedModel;
  }

  function clearMessages() {
    state.itemNodes.clear();
    els.messages.innerHTML = '';
  }

  function addMessage(role, text, id) {
    const node = document.createElement('div');
    node.className = `message ${role}`;
    node.textContent = text || '';
    if (id) {
      state.itemNodes.set(id, node);
    }
    els.messages.appendChild(node);
    els.messages.scrollTop = els.messages.scrollHeight;
    return node;
  }

  function updateMessage(id, role, text, append) {
    if (!id) {
      addMessage(role, text);
      return;
    }
    const node = state.itemNodes.get(id) || addMessage(role, '', id);
    node.className = `message ${role}`;
    node.textContent = append ? `${node.textContent}${text || ''}` : (text || '');
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function addEvent(text) {
    addMessage('event', text);
  }

  function inputText(content) {
    if (Array.isArray(content)) {
      return content.map((part) => part?.text || part?.content || '').filter(Boolean).join('\n');
    }
    return typeof content === 'string' ? content : '';
  }

  function renderItem(item) {
    if (!item || !item.type) return;

    if (item.type === 'userMessage') {
      updateMessage(item.id, 'user', inputText(item.content), false);
      return;
    }

    if (item.type === 'agentMessage') {
      updateMessage(item.id, 'agent', item.text || '', false);
      return;
    }

    if (item.type === 'plan') {
      updateMessage(item.id, 'event', `计划\n${item.text || ''}`, false);
      return;
    }

    if (item.type === 'commandExecution') {
      const command = Array.isArray(item.command) ? item.command.join(' ') : item.command;
      updateMessage(item.id, 'event', `命令：${command || ''}\n${item.aggregatedOutput || item.status || ''}`, false);
      return;
    }

    if (item.type === 'fileChange') {
      const count = Array.isArray(item.changes) ? item.changes.length : 0;
      updateMessage(item.id, 'event', `文件变更：${count} 项，状态 ${item.status || 'unknown'}`, false);
      return;
    }

    if (item.type === 'reasoning') {
      const summary = Array.isArray(item.summary) ? item.summary.join('\n') : item.summary;
      if (summary) updateMessage(item.id, 'event', `思考摘要\n${summary}`, false);
      return;
    }

    addEvent(`${item.type}: ${item.status || '已更新'}`);
  }

  function renderTurns(turns) {
    clearMessages();
    const items = [];
    const orderedTurns = (turns || []).slice();
    const firstTime = orderedTurns[0]?.createdAt || orderedTurns[0]?.completedAt;
    const lastTime = orderedTurns[orderedTurns.length - 1]?.createdAt || orderedTurns[orderedTurns.length - 1]?.completedAt;
    if (firstTime && lastTime && firstTime > lastTime) {
      orderedTurns.reverse();
    }
    orderedTurns.forEach((turn) => {
      (turn.items || []).forEach((item) => items.push(item));
    });

    if (!items.length) {
      els.messages.innerHTML = '<div class="empty-state"><strong>这个会话还没有可显示的消息。</strong><span>可以直接在下面继续发送。</span></div>';
      return;
    }

    items.forEach(renderItem);
  }

  async function request(method, params = {}, timeoutMs = 30000) {
    const response = await window.electronAPI.requestCodexAppServer(method, params, timeoutMs);
    if (!response?.success) {
      throw new Error(response?.error || `${method} 请求失败`);
    }
    return response.result;
  }

  function turnOptions() {
    const cwd = normalizeCwd(els.cwdInput.value || state.selectedCwd);
    const model = els.modelSelect.value || state.selectedModel;
    const options = {};
    if (cwd) options.cwd = cwd;
    if (model) options.model = model;
    return options;
  }

  function handleNotification(message) {
    const params = message.params || {};
    if (message.method === 'item/agentMessage/delta') {
      const text = params.delta || params.text || params.chunk || '';
      updateMessage(params.itemId || params.item?.id, 'agent', text, true);
      return;
    }

    if (message.method === 'item/started' || message.method === 'item/completed') {
      renderItem(params.item);
      return;
    }

    if (message.method === 'turn/started') {
      state.activeTurnId = params.turn?.id || state.activeTurnId;
      setBusy(true);
      return;
    }

    if (message.method === 'turn/completed') {
      const turn = params.turn || {};
      state.activeTurnId = null;
      setBusy(false);
      if (turn.status === 'failed') {
        addEvent(`失败：${turn.error?.message || 'Codex turn failed'}`);
      }
      refreshThreads(false).catch(() => {});
      return;
    }

    if (message.method === 'thread/name/updated') {
      refreshThreads(false).catch(() => {});
    }
  }

  async function connect() {
    if (state.connecting) return;
    if (!state.config?.enabled) {
      setStatus('error', '插件未启用', '请先在设置里启用 Codex 操控插件。');
      return;
    }
    if (!state.config?.appServerWsUrl) {
      setStatus('error', '缺少地址', '请先到设置里的 Codex 操控插件填写 app-server WS 地址。');
      return;
    }

    state.connecting = true;
    setStatus('idle', '连接中', state.config.appServerWsUrl);
    els.connectBtn.disabled = true;

    const response = await window.electronAPI.connectCodexAppServer();
    state.connecting = false;
    els.connectBtn.disabled = false;

    if (!response?.success) {
      state.connected = false;
      setBusy(false);
      setStatus('error', '连接失败', response?.error || 'app-server 连接失败');
      return;
    }

    state.connected = true;
    setStatus('connected', '已连接', response.url || state.config.appServerWsUrl);
    setBusy(false);
    await loadModels();
    await refreshThreads();
  }

  async function loadModels() {
    try {
      const result = await request('model/list', {}, 30000);
      state.models = (Array.isArray(result?.data) ? result.data : []).filter((model) => !model.hidden);
    } catch (error) {
      state.models = [];
      addEvent(`模型列表读取失败，使用默认模型：${error.message}`);
    }
    renderModels();
  }

  async function refreshThreads(showLoading = true) {
    if (!state.connected) return;
    if (showLoading) {
      els.threadList.innerHTML = '<div class="empty-state"><strong>读取中...</strong><span>正在拉取远端会话。</span></div>';
    }
    const result = await request('thread/list', {
      limit: 80,
      sortKey: 'updated_at',
      sourceKinds: SOURCE_KINDS
    });
    state.threads = Array.isArray(result?.data) ? result.data : [];
    updateCwdOptions();
    if (!state.selectedCwd && state.threads[0]?.cwd) {
      state.selectedCwd = normalizeCwd(state.threads[0].cwd);
      els.cwdInput.value = state.selectedCwd;
      if (state.newThreadMode) {
        setHeaderForNewThread();
        renderEmptyPrompt();
      }
    }
    renderThreads();
  }

  async function readThread(threadId) {
    const result = await request('thread/read', { threadId, includeTurns: true }, 30000);
    return result?.thread || null;
  }

  async function ensureResumed(threadId) {
    if (state.resumedThreads.has(threadId)) return;
    await request('thread/resume', {
      threadId,
      personality: 'friendly',
      ...turnOptions()
    }, 30000);
    state.resumedThreads.add(threadId);
  }

  async function selectThread(threadId) {
    state.selectedThreadId = threadId;
    state.newThreadMode = false;
    state.itemNodes.clear();
    renderThreads();
    els.threadTitle.textContent = '读取会话中...';
    els.threadMeta.textContent = threadId;
    els.messages.innerHTML = '<div class="empty-state"><strong>读取历史中...</strong><span>稍等一下。</span></div>';
    setBusy(true);

    try {
      const thread = await readThread(threadId);
      const known = state.threads.find((item) => item.id === threadId) || thread;
      state.selectedCwd = normalizeCwd(thread?.cwd || known?.cwd || state.selectedCwd);
      els.cwdInput.value = state.selectedCwd;
      els.threadTitle.textContent = getThreadTitle(thread || known);
      els.threadMeta.textContent = `${projectNameFromCwd(state.selectedCwd)}${state.selectedCwd ? ` · ${state.selectedCwd}` : ''}`;
      renderTurns(thread?.turns || []);
      await ensureResumed(threadId);
    } catch (error) {
      clearMessages();
      addEvent(`读取失败：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function startThreadForPrompt() {
    const options = turnOptions();
    const result = await request('thread/start', {
      serviceName: 'desktop_pet_codex_control',
      ...options
    });
    const thread = result?.thread;
    if (!thread?.id) throw new Error('新建会话没有返回 thread id');
    state.selectedThreadId = thread.id;
    state.newThreadMode = false;
    state.selectedCwd = normalizeCwd(thread.cwd || options.cwd || state.selectedCwd);
    state.threads.unshift({ ...thread, cwd: state.selectedCwd });
    state.resumedThreads.add(thread.id);
    updateCwdOptions();
    renderThreads();
    els.threadTitle.textContent = getThreadTitle(thread);
    els.threadMeta.textContent = `${projectNameFromCwd(state.selectedCwd)}${state.selectedCwd ? ` · ${state.selectedCwd}` : ''}`;
    return thread.id;
  }

  async function sendPrompt(text) {
    if (!text.trim()) return;
    if (!state.connected) await connect();
    if (!state.selectedThreadId) {
      await startThreadForPrompt();
    }

    const threadId = state.selectedThreadId;
    await ensureResumed(threadId);
    if (els.messages.querySelector('.empty-state')) clearMessages();
    addMessage('user', text);
    els.promptInput.value = '';
    setBusy(true);

    const result = await request('turn/start', {
      threadId,
      input: [{ type: 'text', text }],
      ...turnOptions()
    }, 30000);
    state.activeTurnId = result?.turn?.id || state.activeTurnId;
  }

  async function stopTurn() {
    if (!state.selectedThreadId || !state.activeTurnId) return;
    await request('turn/interrupt', {
      threadId: state.selectedThreadId,
      turnId: state.activeTurnId
    });
  }

  async function loadConfig() {
    state.config = await window.electronAPI.getCodexControlPluginState();
    if (!state.config?.enabled) {
      setStatus('error', '插件未启用', '请先在设置里启用 Codex 操控插件。');
      renderEmptyPrompt();
      return;
    }
    setStatus('idle', '准备连接', state.config.appServerWsUrl || '未填写 app-server WS 地址');
    renderEmptyPrompt();
    if (state.config.appServerWsUrl) {
      await connect().catch((error) => setStatus('error', '连接失败', error.message));
    }
  }

  els.connectBtn.addEventListener('click', () => {
    connect().catch((error) => setStatus('error', '连接失败', error.message));
  });

  els.refreshBtn.addEventListener('click', () => {
    refreshThreads().catch((error) => setStatus('error', '刷新失败', error.message));
  });

  els.newThreadBtn.addEventListener('click', () => {
    enterNewThreadMode(els.cwdInput.value || state.selectedCwd || uniqueCwds()[0] || '');
  });

  els.threadSearch.addEventListener('input', renderThreads);

  els.threadList.addEventListener('click', (event) => {
    const projectButton = event.target.closest('[data-cwd]');
    if (projectButton) {
      enterNewThreadMode(projectButton.dataset.cwd || '');
      return;
    }

    const threadButton = event.target.closest('[data-thread-id]');
    if (!threadButton) return;
    selectThread(threadButton.dataset.threadId);
  });

  els.cwdInput.addEventListener('input', () => {
    state.selectedCwd = normalizeCwd(els.cwdInput.value);
    if (state.newThreadMode) {
      setHeaderForNewThread();
      renderEmptyPrompt();
      renderThreads();
    }
  });

  els.modelSelect.addEventListener('change', () => {
    state.selectedModel = els.modelSelect.value;
  });

  els.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    sendPrompt(els.promptInput.value).catch((error) => {
      setBusy(false);
      addEvent(`发送失败：${error.message}`);
    });
  });

  els.promptInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      els.composer.requestSubmit();
    }
  });

  els.stopBtn.addEventListener('click', () => {
    stopTurn().catch((error) => addEvent(`停止失败：${error.message}`));
  });

  window.electronAPI.onCodexControlPluginStateChanged((nextState) => {
    state.config = nextState;
    state.connected = false;
    state.resumedThreads.clear();
    setBusy(false);
    setStatus('idle', nextState.enabled ? '配置已更新' : '插件未启用', nextState.appServerWsUrl || '未填写 app-server WS 地址');
  });

  window.electronAPI.onCodexAppServerEvent(handleNotification);
  window.electronAPI.onCodexAppServerStatus((status) => {
    if (status.state === 'connected') {
      state.connected = true;
      setStatus('connected', '已连接', status.url || state.config?.appServerWsUrl || '');
      setBusy(false);
      return;
    }
    if (status.state === 'closed' || status.state === 'error') {
      state.connected = false;
      state.resumedThreads.clear();
      setBusy(false);
      setStatus('error', status.state === 'closed' ? '已断开' : '连接异常', status.message || '');
    }
  });

  loadConfig().catch((error) => setStatus('error', '初始化失败', error.message));
})();
