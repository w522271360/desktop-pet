// 设置页面 - 侧边栏导航版本
let appConfig = null;
let apiConfigs = [];
let editingConfigId = null;
let reminders = [];
let editingReminderId = null;
let eventsBound = false;

// DOM元素 - 导航
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// DOM元素 - API配置
const configsContainer = document.getElementById('configs-container');
const addConfigBtn = document.getElementById('add-config-btn');
const pluginsTabBody = document.getElementById('plugin-list-container');
const deepseekPluginStatusBadge = document.getElementById('deepseek-plugin-status-badge');
const deepseekLoginBtn = document.getElementById('deepseek-login-btn');
const deepseekSaveAuthBtn = document.getElementById('deepseek-save-auth-btn');
const deepseekClearAuthBtn = document.getElementById('deepseek-clear-auth-btn');
const deepseekTokenInput = document.getElementById('deepseek-token-input');
const deepseekTokenToggle = document.getElementById('deepseek-token-toggle');

// DOM元素 - 提醒事项
const remindersContainer = document.getElementById('reminders-container');
const addReminderBtn = document.getElementById('add-reminder-btn');
const reminderModal = document.getElementById('reminder-modal');
const reminderModalTitle = document.getElementById('reminder-modal-title');
const closeReminderModalBtn = document.getElementById('close-reminder-modal-btn');
const reminderTitleInput = document.getElementById('reminder-title-input');
const reminderNoteInput = document.getElementById('reminder-note-input');
const reminderTimeInput = document.getElementById('reminder-time-input');
const reminderRepeatInput = document.getElementById('reminder-repeat-input');
const reminderIntervalRow = document.getElementById('reminder-interval-row');
const reminderIntervalValueInput = document.getElementById('reminder-interval-value-input');
const reminderIntervalUnitInput = document.getElementById('reminder-interval-unit-input');
const reminderEnabledInput = document.getElementById('reminder-enabled-input');
const cancelReminderBtn = document.getElementById('cancel-reminder-btn');
const saveReminderBtn = document.getElementById('save-reminder-btn');

// DOM元素 - 通用设置
const alwaysOnTopCheckbox = document.getElementById('always-on-top');
const launchAtLoginCheckbox = document.getElementById('launch-at-login');

// DOM元素 - 外观设置
const darkModeToggle = document.getElementById('dark-mode-toggle');
const themePreview = document.getElementById('theme-preview');

// DOM元素 - 桌面宠物设置
const petCharacterSelect = document.getElementById('pet-character');
const petSizeSelect = document.getElementById('pet-size');

// DOM元素 - 对话界面设置
const themeSelect = document.getElementById('theme-select');
const fontSizeSelect = document.getElementById('font-size');

// DOM元素 - 对话设置
const autoOpenChatCheckbox = document.getElementById('auto-open-chat');
const saveHistoryCheckbox = document.getElementById('save-history');
const agentModeEnabledCheckbox = document.getElementById('agent-mode-enabled');
const petChatBubbleEnabledCheckbox = document.getElementById('pet-chat-bubble-enabled');
const agentWorkDirectoryInput = document.getElementById('agent-work-directory');
const agentWorkDirectoryBrowseBtn = document.getElementById('agent-work-directory-browse');
const agentWorkDirectoryClearBtn = document.getElementById('agent-work-directory-clear');
const assistantNicknameInput = document.getElementById('assistant-nickname');
const userDisplayNameInput = document.getElementById('user-display-name');

// DOM元素 - 联网服务
const personalModeBtn = document.getElementById('personal-mode-btn');
const networkModeBtn = document.getElementById('network-mode-btn');
const networkSettingsSection = document.getElementById('network-settings-section');
const networkStatusText = document.getElementById('network-status-text');
const networkStatusDetail = document.getElementById('network-status-detail');
const networkOnlineCount = document.getElementById('network-online-count');
const networkServerUrlInput = document.getElementById('network-server-url');
const networkClientTokenInput = document.getElementById('network-client-token');
const networkNicknameInput = document.getElementById('network-nickname');
const networkEnabledCheckbox = document.getElementById('network-enabled');
const networkSaveBtn = document.getElementById('network-save-btn');
const networkConnectBtn = document.getElementById('network-connect-btn');
const networkDisconnectBtn = document.getElementById('network-disconnect-btn');

// DOM元素 - 其他
const closeBtn = document.getElementById('close-btn');
const modal = document.getElementById('config-modal');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal-btn');
const configNameInput = document.getElementById('config-name');
const providerTypeSelect = document.getElementById('provider-type');
const apiUrlInput = document.getElementById('api-url');
const apiKeyInput = document.getElementById('api-key');
const apiKeyToggle = document.querySelector('#api-key-group .toggle-password');
const apiUrlGroup = document.getElementById('api-url-group');
const apiKeyGroup = document.getElementById('api-key-group');
const deepseekPluginNote = document.getElementById('deepseek-plugin-note');
const modelSelectInput = document.getElementById('model-select');
const modelInfo = document.getElementById('model-info');
const enabledCheckbox = document.getElementById('enabled-checkbox');
const testConfigBtn = document.getElementById('test-config-btn');
const saveConfigBtn = document.getElementById('save-config-btn');
const testResult = document.getElementById('test-result');
const toast = document.getElementById('toast');

let codexControlPluginStatus = null;
let codexControlPluginEnabled = null;
let codexControlPluginWsInput = null;
let codexControlPluginSaveBtn = null;
let codexControlPluginOpenBtn = null;

// 标签页切换功能
function switchTab(tabName) {
  navItems.forEach(item => item.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));
  
  const selectedNav = document.querySelector(`[data-tab="${tabName}"]`);
  const selectedContent = document.getElementById(`${tabName}-tab`);
  
  if (selectedNav && selectedContent) {
    selectedNav.classList.add('active');
    selectedContent.classList.add('active');
  }
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    switchTab(item.dataset.tab);
  });
});

function ensureCodexControlPluginCard() {
  if (!pluginsTabBody || codexControlPluginStatus) return;

  const details = document.createElement('details');
  details.className = 'plugin-details-card';
  details.id = 'codex-control-plugin-details';
  details.innerHTML = `
    <summary class="plugin-summary">
      <div class="summary-content">
        <span class="plugin-icon">⚙️</span>
        <div class="plugin-info-brief">
          <span class="plugin-name">Codex 操控</span>
          <span id="codex-control-plugin-status-badge" class="plugin-status-badge badge-offline">未启用</span>
        </div>
      </div>
      <span class="chevron">▼</span>
    </summary>
    
    <div class="plugin-card-body">
      <div class="plugin-intro">
        <strong>app-server 轻量操控台</strong>
        <p>开启后会在主聊天窗口显示“操控台”按钮，用轻量页面直接管理 Codex 会话。</p>
      </div>
      <div class="setting-item inline">
        <div class="setting-info">
          <label>启用插件</label>
          <p class="setting-desc">关闭时聊天窗口不显示操控台入口。</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="codex-control-plugin-enabled">
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-group">
        <label>app-server WS 地址</label>
        <input type="text" id="codex-control-plugin-ws" placeholder="ws://127.0.0.1:9000 or wss://your-host/app-server">
        <p class="field-note">操控台会直接连接该地址，读取会话、加载历史并继续发送消息。</p>
      </div>
      <div class="action-bar">
        <button id="codex-control-plugin-save-btn" class="primary-btn" type="button">保存插件配置</button>
        <button id="codex-control-plugin-open-btn" class="secondary-btn" type="button">打开操控台</button>
      </div>
    </div>
  `;

  pluginsTabBody.appendChild(details);

  codexControlPluginStatus = document.getElementById('codex-control-plugin-status-badge');
  codexControlPluginEnabled = document.getElementById('codex-control-plugin-enabled');
  codexControlPluginWsInput = document.getElementById('codex-control-plugin-ws');
  codexControlPluginSaveBtn = document.getElementById('codex-control-plugin-save-btn');
  codexControlPluginOpenBtn = document.getElementById('codex-control-plugin-open-btn');
}

async function initialize() {
  ensureCodexControlPluginCard();
  try {
    appConfig = await window.electronAPI.getConfig();
    await loadConfigs();
    const dsState = await window.electronAPI.getDeepSeekPluginState?.();
    await loadDeepSeekPluginState();
    await loadCodexControlPluginState();
    updateProviderOptions(dsState);
  } catch (error) {
    showToast(`❌ 初始化失败：${error.message}`, 'error');
  }

  bindEvents();
  await loadReminders();
  await loadSettings();
  await loadNetworkSettings();
}

async function loadConfigs() {
  apiConfigs = await window.electronAPI.getApiConfigs();
  const activeConfig = await window.electronAPI.getActiveConfig();
  renderConfigs(activeConfig?.id);
}

function renderConfigs(activeId) {
  configsContainer.innerHTML = '';
  apiConfigs.forEach(config => {
    const card = createConfigCard(config, config.id === activeId);
    configsContainer.appendChild(card);
  });
}

function createConfigCard(config, isActive) {
  const card = document.createElement('div');
  card.className = `config-card ${isActive ? 'active' : ''} ${!config.enabled ? 'disabled' : ''}`;
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <span class="provider-icon custom" data-provider="custom"></span>
        <span>${escapeHtml(config.name)}</span>
        ${isActive ? '<span class="card-badge active">当前激活</span>' : ''}
        ${!config.enabled ? '<span class="card-badge disabled">已禁用</span>' : ''}
      </div>
      <div class="card-actions">
        <button class="icon-btn edit-btn-icon" data-id="${config.id}" title="编辑">✏️</button>
        ${!config.isDefault ? `<button class="icon-btn delete-btn" data-id="${config.id}" title="删除">🗑️</button>` : ''}
      </div>
    </div>
    <div class="card-content">
      <div class="card-field">
        <span class="field-label">配置来源</span>
        <div class="field-value">${config.sourceType === 'plugin_deepseek' ? 'DeepSeek 插件' : '自定义 API'}</div>
      </div>
      <div class="card-field">
        <span class="field-label">API 地址</span>
        <div class="field-value">${config.sourceType === 'plugin_deepseek' ? '由插件管理' : escapeHtml(config.apiUrl)}</div>
      </div>
      <div class="card-field">
        <span class="field-label">API 密钥</span>
        <div class="field-value masked">${config.sourceType === 'plugin_deepseek' ? '插件登录信息' : (config.apiKey ? '••••••••••••••••' : '未配置')}</div>
      </div>
      <div class="card-field">
        <span class="field-label">模型 ID</span>
        <div class="field-value">${escapeHtml(config.selectedModel)}</div>
      </div>
    </div>
    <div class="card-footer">
      ${!isActive && config.enabled ? `<button class="card-btn activate-btn" data-id="${config.id}">设为激活</button>` : ''}
      <button class="card-btn test-btn" data-id="${config.id}">测试连接</button>
      <button class="card-btn edit-btn" data-id="${config.id}">编辑</button>
    </div>
  `;
  return card;
}

async function loadReminders() {
  if (!remindersContainer) return;
  reminders = await window.electronAPI.getReminders();
  renderReminders();
}

function renderReminders() {
  if (!remindersContainer) return;
  remindersContainer.innerHTML = '';
  if (reminders.length === 0) {
    remindersContainer.innerHTML = '<div class="empty-state"><h3>还没有提醒</h3></div>';
    return;
  }
  reminders.forEach(reminder => {
    remindersContainer.appendChild(createReminderCard(reminder));
  });
}

function createReminderCard(reminder) {
  const card = document.createElement('div');
  const isDue = reminder.status === 'due';
  const recurrence = reminder.recurrence || { frequency: 'none' };
  card.className = `reminder-card ${reminder.enabled ? '' : 'disabled'} ${isDue ? 'due' : ''}`;
  card.innerHTML = `
    <div class="reminder-card-main">
      <div class="reminder-card-title">
        <span>${escapeHtml(reminder.title)}</span>
        ${recurrence.frequency !== 'none' ? '<span class="card-badge repeat">重复</span>' : ''}
      </div>
      ${reminder.note ? `<div class="reminder-card-note">${escapeHtml(reminder.note)}</div>` : ''}
      <div class="reminder-card-time">${new Date(reminder.scheduledAt).toLocaleString()}</div>
    </div>
    <div class="reminder-card-actions">
      <button class="icon-btn edit-btn" data-id="${reminder.id}" type="button" title="编辑">✏️</button>
      <button class="icon-btn delete-btn" data-id="${reminder.id}" type="button" title="删除">🗑️</button>
    </div>
  `;
  return card;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]));
}

async function loadSettings() {
  const alwaysOnTop = await window.electronAPI.storeGet('alwaysOnTop') ?? true;
  if (alwaysOnTopCheckbox) alwaysOnTopCheckbox.checked = alwaysOnTop;
  const launchState = await window.electronAPI.getLaunchAtLogin?.();
  if (launchAtLoginCheckbox) launchAtLoginCheckbox.checked = launchState?.enabled ?? (await window.electronAPI.storeGet('launchAtLogin') || false);
  const darkMode = await window.electronAPI.storeGet('darkMode') || false;
  if (darkModeToggle) darkModeToggle.checked = darkMode;
  applyTheme(darkMode);
  updateThemePreview(darkMode);
  await loadPetSettings();
  await loadChatSettings();
}

async function loadNetworkSettings() {
  const mode = await window.electronAPI.storeGet('petAppMode') || 'personal';
  applyNetworkMode(mode);
  if (networkServerUrlInput) networkServerUrlInput.value = await window.electronAPI.storeGet('petServerUrl') || '';
  if (networkClientTokenInput) networkClientTokenInput.value = await window.electronAPI.storeGet('petNetworkClientToken') || '';
  if (networkNicknameInput) networkNicknameInput.value = await window.electronAPI.storeGet('petNetworkNickname') || await window.electronAPI.storeGet('userDisplayName') || '';
  if (networkEnabledCheckbox) networkEnabledCheckbox.checked = await window.electronAPI.storeGet('petNetworkEnabled') || false;
  renderNetworkState(await window.electronAPI.getPetNetworkState?.());
}

function applyNetworkMode(mode) {
  const isNetwork = mode === 'network';
  personalModeBtn?.classList.toggle('active', !isNetwork);
  networkModeBtn?.classList.toggle('active', isNetwork);
  networkSettingsSection?.classList.toggle('disabled-section', !isNetwork);
}

function renderNetworkState(state = {}) {
  const statusLabels = {
    disabled: '未启用',
    disconnected: '未连接',
    connecting: '连接中',
    connected: '已连接',
    error: '连接异常'
  };
  if (networkStatusText) networkStatusText.textContent = statusLabels[state?.status] || state?.status || '未连接';
  if (networkStatusDetail) networkStatusDetail.textContent = state?.error || state?.serverUrl || '个人版不会连接联网服务。';
  if (networkOnlineCount) networkOnlineCount.textContent = `${Array.isArray(state?.users) ? state.users.length : 0} 人在线`;
}

async function loadDeepSeekPluginState() {
  const state = await window.electronAPI.getDeepSeekPluginState?.();
  if (!state || !deepseekPluginStatusBadge) return;
  const isOnline = state.hasToken;
  deepseekPluginStatusBadge.textContent = isOnline ? '已登录' : '未登录';
  deepseekPluginStatusBadge.className = `plugin-status-badge ${isOnline ? 'badge-online' : 'badge-offline'}`;
}

async function loadCodexControlPluginState() {
  ensureCodexControlPluginCard();
  const state = await window.electronAPI.getCodexControlPluginState?.();
  if (!state || !codexControlPluginStatus) return;
  const isEnabled = state.enabled === true;
  codexControlPluginEnabled.checked = isEnabled;
  codexControlPluginWsInput.value = state.appServerWsUrl || '';
  codexControlPluginStatus.textContent = isEnabled ? '已启用' : '未启用';
  codexControlPluginStatus.className = `plugin-status-badge ${isEnabled ? 'badge-online' : 'badge-offline'}`;
}

function updateProviderOptions(deepseekPluginState) {
  const dsOption = providerTypeSelect.querySelector('option[value="deepseek"]');
  if (dsOption) dsOption.hidden = !deepseekPluginState?.hasToken;
}

async function loadPetSettings() {
  if (petCharacterSelect) petCharacterSelect.value = await window.electronAPI.storeGet('petCharacter') || 'bubu';
  if (petSizeSelect) petSizeSelect.value = await window.electronAPI.storeGet('petSize') || 'medium';
}

async function loadChatSettings() {
  const theme = await window.electronAPI.storeGet('chatTheme') || 'shiba';
  if (themeSelect) themeSelect.value = theme;
  applyChatTheme(theme);
  
  if (fontSizeSelect) fontSizeSelect.value = await window.electronAPI.storeGet('chatFontSize') || 'medium';
  if (autoOpenChatCheckbox) autoOpenChatCheckbox.checked = await window.electronAPI.storeGet('autoOpenChat') || false;
  if (saveHistoryCheckbox) saveHistoryCheckbox.checked = await window.electronAPI.storeGet('saveHistory') ?? true;
  if (agentModeEnabledCheckbox) agentModeEnabledCheckbox.checked = await window.electronAPI.storeGet('agentModeEnabled') || false;
  if (petChatBubbleEnabledCheckbox) petChatBubbleEnabledCheckbox.checked = await window.electronAPI.storeGet('petChatBubbleEnabled') ?? true;
  if (agentWorkDirectoryInput) agentWorkDirectoryInput.value = await window.electronAPI.storeGet('agentWorkDirectory') || '';
  if (assistantNicknameInput) assistantNicknameInput.value = await window.electronAPI.storeGet('assistantNickname') || '';
  if (userDisplayNameInput) userDisplayNameInput.value = await window.electronAPI.storeGet('userDisplayName') || '';
}

function applyTheme(isDarkMode) {
  document.body.classList.toggle('dark-mode', isDarkMode);
}

function applyChatTheme(theme) {
  // 移除所有主题类
  document.body.classList.remove('theme-shiba', 'theme-blue', 'theme-purple', 'theme-green');
  // 添加新主题类（shiba 是默认主题，不需要添加类）
  if (theme !== 'shiba') {
    document.body.classList.add(`theme-${theme}`);
  }
}

function updateThemePreview(isDarkMode) {
  themePreview?.querySelector('.preview-card.light')?.classList.toggle('active', !isDarkMode);
  themePreview?.querySelector('.preview-card.dark')?.classList.toggle('active', isDarkMode);
}

async function saveNetworkSettings() {
  const mode = networkModeBtn?.classList.contains('active') ? 'network' : 'personal';
  const state = await window.electronAPI.updatePetNetworkConfig({
    petAppMode: mode,
    petNetworkEnabled: networkEnabledCheckbox?.checked || false,
    petServerUrl: networkServerUrlInput?.value.trim() || '',
    petNetworkClientToken: networkClientTokenInput?.value.trim() || '',
    petNetworkNickname: networkNicknameInput?.value.trim() || ''
  });
  renderNetworkState(state);
  showToast('✅ 联网设置已保存', 'success');
}

async function setNetworkMode(mode) {
  applyNetworkMode(mode);
  const state = await window.electronAPI.setPetNetworkMode(mode);
  renderNetworkState(state);
}

async function openReminderModal(reminder = null) {
  editingReminderId = reminder?.id || null;
  reminderModalTitle.textContent = reminder ? '编辑提醒' : '添加提醒';
  reminderTitleInput.value = reminder?.title || '';
  reminderNoteInput.value = reminder?.note || '';
  reminderTimeInput.value = toDateTimeLocalValue(reminder?.scheduledAt || Date.now() + 5 * 60 * 1000);
  const recurrence = reminder?.recurrence || { frequency: 'none' };
  reminderRepeatInput.value = recurrence.frequency || 'none';
  reminderIntervalValueInput.value = recurrence.interval || 1;
  reminderIntervalUnitInput.value = recurrence.unit || 'days';
  reminderEnabledInput.checked = reminder?.enabled ?? true;
  updateReminderIntervalVisibility();
  reminderModal.classList.remove('hidden');
}

function closeReminderModal() {
  reminderModal.classList.add('hidden');
  editingReminderId = null;
}

function updateReminderIntervalVisibility() {
  reminderIntervalRow?.classList.toggle('hidden', reminderRepeatInput?.value !== 'interval');
}

function toDateTimeLocalValue(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

async function saveCurrentReminder() {
  const title = reminderTitleInput.value.trim();
  const scheduledAt = reminderTimeInput.value ? new Date(reminderTimeInput.value).toISOString() : '';
  if (!title || !scheduledAt) {
    showToast('❌ 请填写提醒标题和时间', 'error');
    return;
  }

  const frequency = reminderRepeatInput.value;
  const reminder = {
    id: editingReminderId,
    title,
    note: reminderNoteInput.value.trim(),
    scheduledAt,
    recurrence: frequency === 'interval'
      ? {
          frequency,
          interval: Number(reminderIntervalValueInput.value) || 1,
          unit: reminderIntervalUnitInput.value
        }
      : { frequency },
    enabled: reminderEnabledInput.checked
  };

  await window.electronAPI.saveReminder(reminder);
  await loadReminders();
  closeReminderModal();
  showToast('✅ 提醒已保存', 'success');
}

async function testApiConfig(config) {
  const result = await window.electronAPI.testApiConfig(config);
  const ok = result?.success ?? result?.ok;
  showToast(ok ? '✅ 连接测试成功' : `❌ ${result?.message || '连接测试失败'}`, ok ? 'success' : 'error');
}

function getCurrentModalConfig() {
  const isDS = providerTypeSelect.value === 'deepseek';
  return {
    name: configNameInput.value.trim(),
    provider: isDS ? 'deepseek' : 'custom',
    sourceType: isDS ? 'plugin_deepseek' : 'custom_openai',
    apiUrl: isDS ? '' : apiUrlInput.value.trim(),
    apiKey: isDS ? '' : apiKeyInput.value.trim(),
    selectedModel: modelSelectInput.value.trim(),
    enabled: enabledCheckbox?.checked ?? true
  };
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  navItems.forEach(item => item.addEventListener('click', () => switchTab(item.dataset.tab)));

  addConfigBtn?.addEventListener('click', () => openModal());
  configsContainer?.addEventListener('click', async event => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;
    const id = button.dataset.id;
    const config = apiConfigs.find(item => item.id === id);
    if (!config) return;

    if (button.classList.contains('edit-btn') || button.classList.contains('edit-btn-icon')) {
      openModal(config);
    } else if (button.classList.contains('activate-btn')) {
      await window.electronAPI.setActiveConfig(id);
      await loadConfigs();
      showToast('✅ 已切换激活配置', 'success');
    } else if (button.classList.contains('delete-btn')) {
      if (confirm(`确定删除配置「${config.name}」吗？`)) {
        await window.electronAPI.deleteApiConfig(id);
        await loadConfigs();
        showToast('✅ 配置已删除', 'success');
      }
    } else if (button.classList.contains('test-btn')) {
      await testApiConfig(config);
    }
  });

  deepseekLoginBtn?.addEventListener('click', async () => await window.electronAPI.openDeepSeekLogin());
  deepseekSaveAuthBtn?.addEventListener('click', async () => {
    await window.electronAPI.saveDeepSeekAuth(deepseekTokenInput.value.trim());
    await loadDeepSeekPluginState();
    updateProviderOptions(await window.electronAPI.getDeepSeekPluginState());
    showToast('✅ DeepSeek 授权已保存', 'success');
  });
  deepseekClearAuthBtn?.addEventListener('click', async () => {
    await window.electronAPI.clearDeepSeekAuth();
    await loadDeepSeekPluginState();
    updateProviderOptions(null);
    showToast('✅ DeepSeek 授权已清除', 'success');
  });
  deepseekTokenToggle?.addEventListener('click', () => {
    deepseekTokenInput.type = deepseekTokenInput.type === 'password' ? 'text' : 'password';
  });
  apiKeyToggle?.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  codexControlPluginSaveBtn?.addEventListener('click', async () => {
    await window.electronAPI.saveCodexControlPluginState({
      enabled: codexControlPluginEnabled.checked,
      appServerWsUrl: codexControlPluginWsInput.value.trim()
    });
    await loadCodexControlPluginState();
    showToast('✅ Codex 控制台设置已保存', 'success');
  });
  codexControlPluginOpenBtn?.addEventListener('click', () => window.electronAPI.openCodexControl());

  addReminderBtn?.addEventListener('click', () => openReminderModal());
  remindersContainer?.addEventListener('click', async event => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;
    const id = button.dataset.id;
    const reminder = reminders.find(item => item.id === id);
    if (!reminder) return;

    if (button.classList.contains('edit-btn')) {
      openReminderModal(reminder);
    } else if (button.classList.contains('delete-btn')) {
      if (confirm(`确定删除提醒「${reminder.title}」吗？`)) {
        await window.electronAPI.deleteReminder(id);
        await loadReminders();
        showToast('✅ 提醒已删除', 'success');
      }
    }
  });
  reminderRepeatInput?.addEventListener('change', updateReminderIntervalVisibility);
  saveReminderBtn?.addEventListener('click', saveCurrentReminder);
  closeReminderModalBtn?.addEventListener('click', closeReminderModal);
  cancelReminderBtn?.addEventListener('click', closeReminderModal);

  closeBtn?.addEventListener('click', () => window.close());
  darkModeToggle?.addEventListener('change', async () => {
    const isDark = darkModeToggle.checked;
    await window.electronAPI.storeSet('darkMode', isDark);
    applyTheme(isDark);
    updateThemePreview(isDark);
    window.electronAPI.broadcastThemeChange(isDark);
  });

  alwaysOnTopCheckbox?.addEventListener('change', () => window.electronAPI.storeSet('alwaysOnTop', alwaysOnTopCheckbox.checked));
  launchAtLoginCheckbox?.addEventListener('change', () => window.electronAPI.storeSet('launchAtLogin', launchAtLoginCheckbox.checked));
  petCharacterSelect?.addEventListener('change', async () => {
    await window.electronAPI.storeSet('petCharacter', petCharacterSelect.value);
    window.electronAPI.updatePetImage(petCharacterSelect.value);
  });
  petSizeSelect?.addEventListener('change', async () => {
    await window.electronAPI.storeSet('petSize', petSizeSelect.value);
    window.electronAPI.updatePetSize(petSizeSelect.value);
  });
  themeSelect?.addEventListener('change', async () => {
    const theme = themeSelect.value;
    await window.electronAPI.storeSet('chatTheme', theme);
    applyChatTheme(theme);
    window.electronAPI.updateChatTheme(theme);
  });
  fontSizeSelect?.addEventListener('change', () => window.electronAPI.storeSet('fontSize', fontSizeSelect.value));
  autoOpenChatCheckbox?.addEventListener('change', () => window.electronAPI.storeSet('autoOpenChat', autoOpenChatCheckbox.checked));
  saveHistoryCheckbox?.addEventListener('change', () => window.electronAPI.storeSet('saveHistory', saveHistoryCheckbox.checked));
  agentModeEnabledCheckbox?.addEventListener('change', () => window.electronAPI.storeSet('agentModeEnabled', agentModeEnabledCheckbox.checked));
  petChatBubbleEnabledCheckbox?.addEventListener('change', () => window.electronAPI.storeSet('petChatBubbleEnabled', petChatBubbleEnabledCheckbox.checked));
  assistantNicknameInput?.addEventListener('change', () => window.electronAPI.storeSet('assistantNickname', assistantNicknameInput.value.trim()));
  userDisplayNameInput?.addEventListener('change', () => window.electronAPI.storeSet('userDisplayName', userDisplayNameInput.value.trim()));
  agentWorkDirectoryBrowseBtn?.addEventListener('click', async () => {
    const directory = await window.electronAPI.selectDirectory(agentWorkDirectoryInput.value.trim());
    if (directory) {
      agentWorkDirectoryInput.value = directory;
      await window.electronAPI.storeSet('agentWorkDirectory', directory);
    }
  });
  agentWorkDirectoryClearBtn?.addEventListener('click', async () => {
    agentWorkDirectoryInput.value = '';
    await window.electronAPI.storeSet('agentWorkDirectory', '');
  });

  personalModeBtn?.addEventListener('click', () => setNetworkMode('personal'));
  networkModeBtn?.addEventListener('click', () => setNetworkMode('network'));
  networkSaveBtn?.addEventListener('click', saveNetworkSettings);
  networkConnectBtn?.addEventListener('click', async () => {
    networkEnabledCheckbox.checked = true;
    await saveNetworkSettings();
  });
  networkDisconnectBtn?.addEventListener('click', async () => {
    networkEnabledCheckbox.checked = false;
    await saveNetworkSettings();
  });

  providerTypeSelect?.addEventListener('change', applyProviderFormMode);
  saveConfigBtn?.addEventListener('click', saveCurrentConfig);
  testConfigBtn?.addEventListener('click', () => testApiConfig(getCurrentModalConfig()));
  closeModalBtn?.addEventListener('click', closeModal);
}

function openModal(config = null) {
  editingConfigId = config?.id || null;
  if (config) {
    configNameInput.value = config.name;
    providerTypeSelect.value = config.sourceType === 'plugin_deepseek' ? 'deepseek' : 'custom';
    apiUrlInput.value = config.apiUrl || '';
    apiKeyInput.value = config.apiKey || '';
    modelSelectInput.value = config.selectedModel || '';
  } else {
    configNameInput.value = '';
    providerTypeSelect.value = 'custom';
    apiUrlInput.value = '';
    apiKeyInput.value = '';
    modelSelectInput.value = '';
  }
  applyProviderFormMode();
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  editingConfigId = null;
}

function applyProviderFormMode() {
  const isDS = providerTypeSelect.value === 'deepseek';
  apiUrlGroup.classList.toggle('hidden', isDS);
  apiKeyGroup.classList.toggle('hidden', isDS);
}

async function saveCurrentConfig() {
  const isDS = providerTypeSelect.value === 'deepseek';
  const config = {
    name: configNameInput.value.trim(),
    provider: isDS ? 'deepseek' : 'custom',
    sourceType: isDS ? 'plugin_deepseek' : 'custom_openai',
    apiUrl: isDS ? '' : apiUrlInput.value.trim(),
    apiKey: isDS ? '' : apiKeyInput.value.trim(),
    selectedModel: modelSelectInput.value.trim(),
    enabled: true
  };
  if (editingConfigId) await window.electronAPI.updateApiConfig(editingConfigId, config);
  else await window.electronAPI.addApiConfig(config);
  await loadConfigs();
  closeModal();
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

initialize();
