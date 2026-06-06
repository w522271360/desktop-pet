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
    pendingUserMessages: [],
    resumedThreads: new Set(),
    newThreadMode: true,
    collapsedProjects: new Set(),
    expandedProjects: new Set(),
    selectedSpeed: 'medium',
    menuThreadId: null
  };

  const els = {
    statusDot: document.getElementById('status-dot'),
    statusTitle: document.getElementById('status-title'),
    statusDetail: document.getElementById('status-detail'),
    connectBtn: document.getElementById('connect-btn'),
    newThreadBtn: document.getElementById('new-thread-btn'),
    threadSearch: document.getElementById('thread-search'),
    threadList: document.getElementById('thread-list'),
    threadMenu: document.getElementById('thread-menu'),
    threadTitle: document.getElementById('thread-title'),
    threadMeta: document.getElementById('thread-meta'),
    messages: document.getElementById('messages'),
    composer: document.getElementById('composer'),
    promptInput: document.getElementById('prompt-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    cwdInput: document.getElementById('cwd-input'),
    cwdOptions: document.getElementById('cwd-options'),
    modelSelect: document.getElementById('model-select'),
    speedSelect: document.getElementById('speed-select'),
    renameModal: document.getElementById('rename-modal'),
    renameInput: document.getElementById('rename-input'),
    renameCancel: document.getElementById('rename-cancel'),
    renameConfirm: document.getElementById('rename-confirm')
  };

  function setStatus(kind, title, detail) {
    els.statusDot.classList.toggle('connected', kind === 'connected');
    els.statusDot.classList.toggle('error', kind === 'error');
    els.statusTitle.textContent = title;
    els.statusDetail.textContent = detail || '';
  }

  function setBusy(isBusy) {
    els.sendBtn.disabled = !state.connected;
    els.sendBtn.classList.toggle('stopping', isBusy);
    els.sendBtn.title = isBusy ? '停止' : '发送 (Enter)';
    els.sendBtn.setAttribute('aria-label', isBusy ? '停止' : '发送');
    els.sendBtn.querySelector('.send-icon').textContent = isBusy ? '■' : '↑';
    els.promptInput.disabled = !state.connected || isBusy;
    els.cwdInput.disabled = !state.connected || isBusy;
    els.modelSelect.disabled = !state.connected || isBusy;
    els.speedSelect.disabled = !state.connected || isBusy;
    els.stopBtn.classList.add('hidden');
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

  function parseTime(value) {
    if (!value) return null;
    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTime(value) {
    const date = parseTime(value);
    if (!date) return '';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatRelativeTime(value) {
    const date = parseTime(value);
    if (!date) return '';
    const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (diffSeconds < 60) return '刚刚';
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 30) return `${diffDays} 天前`;
    return formatTime(value);
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
      <div class="new-session-state">
        <strong>我们应该在 ${escapeText(projectName)} 中构建什么？</strong>
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

    els.threadList.innerHTML = groupThreads(threads).map((group) => {
      const cwd = normalizeCwd(group.cwd);
      const isCollapsed = !query && state.collapsedProjects.has(cwd);
      const isExpanded = query || state.expandedProjects.has(cwd);
      const visibleThreads = isCollapsed ? [] : (isExpanded ? group.threads : group.threads.slice(0, 5));
      const remainingCount = isCollapsed ? 0 : group.threads.length - visibleThreads.length;

      return `
        <section class="project-group ${isCollapsed ? 'collapsed' : ''}">
          <button class="project-header ${cwd === normalizeCwd(state.selectedCwd) && state.newThreadMode ? 'active' : ''}" type="button" data-cwd="${escapeText(group.cwd)}" data-project-toggle="true" aria-expanded="${!isCollapsed}">
            <span class="project-icon">${isCollapsed ? '▸' : '▾'}</span>
            <span class="project-name">${escapeText(group.name)}</span>
          </button>
          ${visibleThreads.map((thread) => `
            <div class="thread-row ${thread.id === state.selectedThreadId ? 'active' : ''}">
              <button class="thread-item" type="button" data-thread-id="${escapeText(thread.id)}">
                <span class="thread-name">${escapeText(getThreadTitle(thread))}</span>
                <span class="thread-time">${escapeText(formatRelativeTime(thread.updatedAt || thread.createdAt))}</span>
              </button>
              <button class="thread-more" type="button" data-thread-menu="${escapeText(thread.id)}" aria-label="会话操作">⋯</button>
            </div>
          `).join('')}
          ${remainingCount > 0 ? `
            <button class="show-more-threads" type="button" data-cwd="${escapeText(group.cwd)}" data-project-more="true">
              还有 ${remainingCount} 条
            </button>
          ` : ''}
        </section>
      `;
    }).join('');
  }

  function hideThreadMenu() {
    state.menuThreadId = null;
    if (els.threadMenu) {
      els.threadMenu.classList.add('hidden');
      els.threadMenu.setAttribute('aria-hidden', 'true');
    }
  }

  function showThreadMenu(threadId, anchor) {
    if (!els.threadMenu || !threadId || !anchor) return;
    state.menuThreadId = threadId;
    const paneRect = els.threadList.closest('.threads-pane')?.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    els.threadMenu.style.top = `${anchorRect.bottom - (paneRect?.top || 0) + 4}px`;
    els.threadMenu.style.left = `${Math.max(8, anchorRect.right - (paneRect?.left || 0) - 138)}px`;
    els.threadMenu.classList.remove('hidden');
    els.threadMenu.setAttribute('aria-hidden', 'false');
  }

  function threadDisplayName(thread) {
    return thread?.name || getThreadTitle(thread) || '未命名会话';
  }

  async function renameThread(threadId) {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) return;

    els.renameInput.value = threadDisplayName(thread);
    els.renameModal.classList.remove('hidden');
    els.renameInput.focus();
    els.renameInput.select();

    const cleanup = () => {
      els.renameModal.classList.add('hidden');
      els.renameConfirm.onclick = null;
      els.renameCancel.onclick = null;
      els.renameInput.onkeydown = null;
    };

    const commit = async () => {
      const trimmedName = els.renameInput.value.trim();
      if (!trimmedName) {
        cleanup();
        return;
      }
      cleanup();
      try {
        await request('thread/name/set', { threadId, name: trimmedName });
        if (thread) thread.name = trimmedName;
        if (state.selectedThreadId === threadId) {
          els.threadTitle.textContent = trimmedName;
        }
        renderThreads();
        await refreshThreads(false);
      } catch (error) {
        addEvent(`重命名失败：${error.message}`);
      }
    };

    els.renameConfirm.onclick = commit;
    els.renameCancel.onclick = cleanup;
    els.renameInput.onkeydown = (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') cleanup();
    };
  }

  async function archiveThread(threadId) {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!window.confirm(`归档“${threadDisplayName(thread)}”？`)) return;
    try {
      await requestFirst(['thread/archive', 'codex/thread/archive'], { threadId, archived: true });
      state.threads = state.threads.filter((item) => item.id !== threadId);
      if (state.selectedThreadId === threadId) {
        state.selectedThreadId = null;
        state.newThreadMode = false;
        els.threadTitle.textContent = '未选择会话';
        els.threadMeta.textContent = '从左侧选择一个 Codex 会话，或新建会话。';
        clearMessages();
        renderEmptyPrompt();
      }
      renderThreads();
      await refreshThreads(false);
    } catch (error) {
      addEvent(`归档失败：${error.message}`);
    }
  }

  function renderModels() {
    if (!state.models.length) {
      els.modelSelect.innerHTML = '<option value="gpt-5.4">gpt-5.4</option>';
      state.selectedModel = state.selectedModel || 'gpt-5.4';
      els.modelSelect.value = state.selectedModel;
      return;
    }

    els.modelSelect.innerHTML = state.models.map((model) => {
      const value = model.model || model.id || '';
      const label = model.displayName || value;
      return `<option value="${escapeText(value)}">${escapeText(label)}</option>`;
    }).join('');

    const defaultModel = state.models.find((model) => model.isDefault) || state.models[0];
    state.selectedModel = state.selectedModel || defaultModel?.model || defaultModel?.id || '';
    els.modelSelect.value = state.selectedModel;
  }

  function clearMessages() {
    state.itemNodes.clear();
    state.pendingUserMessages = [];
    els.messages.innerHTML = '';
  }

  function renderMessage(node, role, text, options = {}) {
    node.dataset.rawText = text || '';
    node.className = `message ${role}`;
    if (!options.plainText && (role === 'agent' || role === 'event') && window.ChatMarkdown) {
      node.classList.add('markdown-content');
      window.ChatMarkdown.renderMarkdownInto(node, node.dataset.rawText);
      return;
    }
    node.textContent = node.dataset.rawText;
  }

  function addMessage(role, text, id) {
    const node = document.createElement('div');
    renderMessage(node, role, text);
    if (id) {
      state.itemNodes.set(id, node);
    }
    els.messages.appendChild(node);
    els.messages.scrollTop = els.messages.scrollHeight;
    return node;
  }

  function bindPendingUserMessage(id, text) {
    if (!id) return null;
    const index = state.pendingUserMessages.findIndex((entry) => entry.text === text);
    if (index === -1) return null;
    const [entry] = state.pendingUserMessages.splice(index, 1);
    state.itemNodes.set(id, entry.node);
    return entry.node;
  }

  function updateMessage(id, role, text, append, options = {}) {
    if (!id) {
      addMessage(role, text);
      return;
    }
    const node = state.itemNodes.get(id) || addMessage(role, '', id);
    const nextText = append ? `${node.dataset.rawText || ''}${text || ''}` : (text || '');
    renderMessage(node, role, nextText, options);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function addEvent(text) {
    addMessage('event', text);
  }

  function itemId(item) {
    return item?.id || item?.itemId || item?.messageId || item?.uuid || item?.item?.id || '';
  }

  function inputText(content) {
    if (Array.isArray(content)) {
      return content.map((part) => part?.text || part?.content || '').filter(Boolean).join('\n');
    }
    return typeof content === 'string' ? content : '';
  }

  function renderItem(item) {
    if (!item || !item.type) return;

    const id = itemId(item);

    if (item.type === 'userMessage') {
      const text = inputText(item.content);
      const node = bindPendingUserMessage(id, text);
      if (node) {
        renderMessage(node, 'user', text);
      } else {
        updateMessage(id, 'user', text, false);
      }
      return;
    }

    if (item.type === 'agentMessage') {
      updateMessage(id, 'agent', item.text || '', false);
      return;
    }

    if (item.type === 'plan') {
      updateMessage(id, 'event', `计划\n${item.text || ''}`, false);
      return;
    }

    if (item.type === 'commandExecution') {
      const command = Array.isArray(item.command) ? item.command.join(' ') : item.command;
      updateMessage(id, 'event', `命令：${command || ''}\n${item.aggregatedOutput || item.status || ''}`, false, { plainText: true });
      return;
    }

    if (item.type === 'fileChange') {
      const count = Array.isArray(item.changes) ? item.changes.length : 0;
      updateMessage(id, 'event', `文件变更：${count} 项，状态 ${item.status || 'unknown'}`, false);
      return;
    }

    if (item.type === 'reasoning') {
      const summary = Array.isArray(item.summary) ? item.summary.join('\n') : item.summary;
      if (summary) updateMessage(id, 'event', `思考摘要\n${summary}`, false);
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

  async function requestFirst(methods, params = {}, timeoutMs = 30000) {
    let lastError = null;
    for (const method of methods) {
      try {
        return await request(method, params, timeoutMs);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('请求失败');
  }

  function turnOptions() {
    const cwd = normalizeCwd(els.cwdInput.value || state.selectedCwd);
    const model = els.modelSelect.value || state.selectedModel;
    const speed = els.speedSelect.value || state.selectedSpeed;
    const options = {};
    if (cwd) options.cwd = cwd;
    if (model) options.model = model;
    if (speed) options.modelReasoningEffort = speed;
    return options;
  }

  function handleNotification(message) {
    const params = message.params || {};
    if (message.method === 'item/agentMessage/delta') {
      const text = params.delta || params.text || params.chunk || '';
      updateMessage(itemId(params), 'agent', text, true);
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
    if (els.messages.querySelector('.empty-state, .new-session-state')) clearMessages();
    const node = addMessage('user', text);
    state.pendingUserMessages.push({ text, node });
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

  els.newThreadBtn.addEventListener('click', () => {
    enterNewThreadMode(els.cwdInput.value || state.selectedCwd || uniqueCwds()[0] || '');
  });

  els.threadSearch.addEventListener('input', renderThreads);

  els.threadList.addEventListener('click', (event) => {
    const moreButton = event.target.closest('[data-project-more]');
    if (moreButton) {
      const cwd = normalizeCwd(moreButton.dataset.cwd);
      state.expandedProjects.add(cwd);
      state.collapsedProjects.delete(cwd);
      renderThreads();
      return;
    }

    const projectButton = event.target.closest('[data-project-toggle]');
    if (projectButton) {
      const cwd = normalizeCwd(projectButton.dataset.cwd);
      if (state.collapsedProjects.has(cwd)) {
        state.collapsedProjects.delete(cwd);
      } else {
        state.collapsedProjects.add(cwd);
      }
      state.selectedCwd = cwd;
      if (state.newThreadMode) {
        els.cwdInput.value = cwd;
        setHeaderForNewThread();
        renderEmptyPrompt();
      }
      renderThreads();
      return;
    }

    const menuButton = event.target.closest('[data-thread-menu]');
    if (menuButton) {
      event.stopPropagation();
      const threadId = menuButton.dataset.threadMenu;
      if (state.menuThreadId === threadId && !els.threadMenu.classList.contains('hidden')) {
        hideThreadMenu();
      } else {
        showThreadMenu(threadId, menuButton);
      }
      return;
    }

    const threadButton = event.target.closest('[data-thread-id]');
    if (!threadButton) return;
    hideThreadMenu();
    selectThread(threadButton.dataset.threadId);
  });

  els.threadList.addEventListener('contextmenu', (event) => {
    const threadRow = event.target.closest('.thread-row');
    if (!threadRow) return;
    event.preventDefault();
    const threadButton = threadRow.querySelector('[data-thread-id]');
    showThreadMenu(threadButton?.dataset.threadId, threadRow.querySelector('[data-thread-menu]') || threadRow);
  });

  els.threadMenu.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-thread-action]');
    if (!actionButton || !state.menuThreadId) return;
    const threadId = state.menuThreadId;
    hideThreadMenu();
    if (actionButton.dataset.threadAction === 'rename') {
      renameThread(threadId);
      return;
    }
    if (actionButton.dataset.threadAction === 'archive') {
      archiveThread(threadId);
    }
  });

  document.addEventListener('click', (event) => {
    if (els.threadMenu.contains(event.target) || event.target.closest('[data-thread-menu]')) return;
    hideThreadMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideThreadMenu();
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

  els.speedSelect.addEventListener('change', () => {
    state.selectedSpeed = els.speedSelect.value;
  });

  els.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.activeTurnId) {
      stopTurn().catch((error) => addEvent(`停止失败：${error.message}`));
      return;
    }
    sendPrompt(els.promptInput.value).catch((error) => {
      setBusy(false);
      addEvent(`发送失败：${error.message}`);
    });
  });

  els.promptInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
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
