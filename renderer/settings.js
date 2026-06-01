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
const modelSelect = document.getElementById('model-select');
const modelInfo = document.getElementById('model-info');
const enabledCheckbox = document.getElementById('enabled-checkbox');
const testConfigBtn = document.getElementById('test-config-btn');
const saveConfigBtn = document.getElementById('save-config-btn');
const testResult = document.getElementById('test-result');
const toast = document.getElementById('toast');

// 标签页切换功能
function switchTab(tabName) {
  // 移除所有激活状态
  navItems.forEach(item => item.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));
  
  // 激活选中的标签页
  const selectedNav = document.querySelector(`[data-tab="${tabName}"]`);
  const selectedContent = document.getElementById(`${tabName}-tab`);
  
  if (selectedNav && selectedContent) {
    selectedNav.classList.add('active');
    selectedContent.classList.add('active');
  }
}

// 绑定导航点击事件
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabName = item.dataset.tab;
    switchTab(tabName);
  });
});

// 初始化
async function initialize() {
  try {
    appConfig = await window.electronAPI.getConfig();
    await loadConfigs();
  } catch (error) {
    showToast(`❌ API 配置加载失败：${error.message}`, 'error');
  }

  bindEvents();

  try {
    await loadReminders();
  } catch (error) {
    showToast(`❌ 提醒事项加载失败：${error.message}`, 'error');
  }

  try {
    await loadSettings();
  } catch (error) {
    showToast(`❌ 通用设置加载失败：${error.message}`, 'error');
  }

  try {
    await loadNetworkSettings();
  } catch (error) {
    showToast(`❌ 联机设置加载失败：${error.message}`, 'error');
  }
}

// 加载所有配置
async function loadConfigs() {
  apiConfigs = await window.electronAPI.getApiConfigs();
  const activeConfig = await window.electronAPI.getActiveConfig();
  renderConfigs(activeConfig?.id);
}

// 渲染配置卡片
function renderConfigs(activeId) {
  configsContainer.innerHTML = '';
  
  apiConfigs.forEach(config => {
    const card = createConfigCard(config, config.id === activeId);
    configsContainer.appendChild(card);
  });
}

// 创建配置卡片
function createConfigCard(config, isActive) {
  const card = document.createElement('div');
  card.className = `config-card ${isActive ? 'active' : ''} ${!config.enabled ? 'disabled' : ''}`;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <span class="provider-icon custom" data-provider="custom"></span>
        <span>${config.name}</span>
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
        <span class="field-label">API 地址</span>
        <div class="field-value">${config.apiUrl}</div>
      </div>
      
      <div class="card-field">
        <span class="field-label">API 密钥</span>
        <div class="field-value masked">${config.apiKey ? '••••••••••••••••' : '未配置'}</div>
      </div>
      
      <div class="card-field">
        <span class="field-label">模型 ID</span>
        <div class="field-value">${config.selectedModel}</div>
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

function formatReminderDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间无效';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatReminderRecurrence(recurrence = {}) {
  if (!recurrence.frequency || recurrence.frequency === 'none') return '仅一次';
  if (recurrence.frequency === 'daily') return '每天重复';
  if (recurrence.frequency === 'weekly') return '每周重复';
  if (recurrence.frequency === 'monthly') return '每月重复';
  if (recurrence.frequency === 'interval') {
    const unitText = {
      minutes: '分钟',
      hours: '小时',
      days: '天'
    }[recurrence.intervalUnit] || '天';
    return `每 ${recurrence.intervalValue || 1} ${unitText}重复`;
  }
  return '仅一次';
}

function toDateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 5 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function renderReminders() {
  if (!remindersContainer) return;
  remindersContainer.innerHTML = '';

  if (reminders.length === 0) {
    remindersContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏰</div>
        <h3>还没有提醒</h3>
        <p>添加一个提醒，到点后宠物会用气泡叫你。</p>
      </div>
    `;
    return;
  }

  reminders.forEach(reminder => {
    remindersContainer.appendChild(createReminderCard(reminder));
  });
}

function createReminderCard(reminder) {
  const isAcknowledged = reminder.status === 'acknowledged';
  const isDue = !isAcknowledged && new Date(reminder.scheduledAt).getTime() <= Date.now();
  const recurrenceText = formatReminderRecurrence(reminder.recurrence);
  const card = document.createElement('div');
  card.className = `reminder-card ${reminder.enabled ? '' : 'disabled'} ${isDue ? 'due' : ''}`;
  card.innerHTML = `
    <div class="reminder-card-main">
      <div class="reminder-card-title">
        <span>${escapeHtml(reminder.title)}</span>
        ${reminder.recurrence?.frequency && reminder.recurrence.frequency !== 'none' ? '<span class="card-badge repeat">循环</span>' : ''}
        ${isDue ? '<span class="card-badge active">待确认</span>' : ''}
        ${isAcknowledged ? '<span class="card-badge disabled">已确认</span>' : ''}
        ${!reminder.enabled ? '<span class="card-badge disabled">已停用</span>' : ''}
      </div>
      ${reminder.note ? `<div class="reminder-card-note">${escapeHtml(reminder.note)}</div>` : ''}
      <div class="reminder-card-time">${formatReminderDateTime(reminder.scheduledAt)} · ${escapeHtml(recurrenceText)}</div>
    </div>
    <div class="reminder-card-actions">
      <label class="switch" title="启用提醒">
        <input type="checkbox" class="reminder-toggle" data-id="${reminder.id}" ${reminder.enabled ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
      <button class="icon-btn reminder-edit-btn" data-id="${reminder.id}" title="编辑">✏️</button>
      <button class="icon-btn reminder-delete-btn" data-id="${reminder.id}" title="删除">🗑️</button>
    </div>
  `;
  return card;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// 加载其他设置
async function loadSettings() {
  const alwaysOnTop = (await window.electronAPI.storeGet('alwaysOnTop')) ?? true;
  alwaysOnTopCheckbox.checked = alwaysOnTop;

  if (launchAtLoginCheckbox && window.electronAPI.getLaunchAtLogin) {
    try {
      const launchAtLogin = await window.electronAPI.getLaunchAtLogin();
      launchAtLoginCheckbox.checked = launchAtLogin.enabled === true;
      launchAtLoginCheckbox.disabled = launchAtLogin.supported === false;
    } catch (error) {
      launchAtLoginCheckbox.disabled = true;
      console.warn('Failed to load launch-at-login setting:', error.message);
    }
  }
  
  // 加载主题设置
  const darkMode = await window.electronAPI.storeGet('darkMode') || false;
  if (darkModeToggle) {
    darkModeToggle.checked = darkMode;
  }
  
  // 应用主题
  applyTheme(darkMode);
  updateThemePreview(darkMode);
  
  // 加载宠物设置
  await loadPetSettings();
  
  // 加载对话界面设置
  await loadChatSettings();
}

function applyNetworkMode(mode) {
  const isNetwork = mode === 'network';
  personalModeBtn?.classList.toggle('active', !isNetwork);
  networkModeBtn?.classList.toggle('active', isNetwork);
  networkSettingsSection?.classList.toggle('disabled-section', !isNetwork);
}

function renderNetworkState(state = {}) {
  const statusText = {
    disabled: '个人版',
    connecting: '连接中',
    connected: '已连接',
    reconnecting: '重连中',
    error: '连接失败'
  }[state.status] || '未连接';
  if (networkStatusText) networkStatusText.textContent = statusText;
  if (networkStatusDetail) {
    networkStatusDetail.textContent = state.error
      || (state.status === 'connected' ? `已连接到 ${state.serverUrl}` : '联网不可用时，本地功能仍可正常使用。');
  }
  if (networkOnlineCount) {
    networkOnlineCount.textContent = `${Array.isArray(state.users) ? state.users.length : 0} 人在线`;
  }
}

async function loadNetworkSettings() {
  const mode = await window.electronAPI.storeGet('petAppMode') || 'personal';
  applyNetworkMode(mode);
  if (networkServerUrlInput) networkServerUrlInput.value = await window.electronAPI.storeGet('petServerUrl') || '';
  if (networkClientTokenInput) networkClientTokenInput.value = await window.electronAPI.storeGet('petNetworkClientToken') || '';
  if (networkNicknameInput) {
    networkNicknameInput.value = await window.electronAPI.storeGet('petNetworkNickname')
      || await window.electronAPI.storeGet('userDisplayName')
      || '桌宠用户';
  }
  if (networkEnabledCheckbox) networkEnabledCheckbox.checked = await window.electronAPI.storeGet('petNetworkEnabled') === true;
  renderNetworkState(await window.electronAPI.getPetNetworkState?.());
}

async function saveNetworkSettings({ connect = false } = {}) {
  const mode = networkModeBtn?.classList.contains('active') ? 'network' : 'personal';
  const state = await window.electronAPI.updatePetNetworkConfig({
    petAppMode: mode,
    petNetworkEnabled: networkEnabledCheckbox?.checked === true,
    petServerUrl: networkServerUrlInput?.value.trim() || '',
    petNetworkClientToken: networkClientTokenInput?.value.trim() || '',
    petNetworkNickname: networkNicknameInput?.value.trim() || '桌宠用户'
  });
  renderNetworkState(state);
  if (connect && mode === 'network') {
    renderNetworkState(await window.electronAPI.connectPetNetwork());
  }
  showToast('✅ 联网设置已保存', 'success');
}

// 加载对话界面设置
async function loadChatSettings() {
  // 加载主题色彩
  const theme = await window.electronAPI.storeGet('chatTheme') || 'shiba';
  if (themeSelect) {
    themeSelect.value = theme;
  }
  applyChatTheme(theme);
  
  // 加载字体大小
  const fontSize = await window.electronAPI.storeGet('chatFontSize') || 'medium';
  if (fontSizeSelect) {
    fontSizeSelect.value = fontSize;
  }
  
  // 加载启动时自动打开对话窗口设置
  const autoOpenChat = await window.electronAPI.storeGet('autoOpenChat') || false;
  if (autoOpenChatCheckbox) {
    autoOpenChatCheckbox.checked = autoOpenChat;
  }
  
  // 加载保存对话历史设置
  const saveHistory = await window.electronAPI.storeGet('saveHistory');
  if (saveHistoryCheckbox) {
    saveHistoryCheckbox.checked = saveHistory !== false; // 默认开启
  }

  const assistantNickname = await window.electronAPI.storeGet('assistantNickname') || '小秘书';
  if (assistantNicknameInput) {
    assistantNicknameInput.value = assistantNickname;
  }

  const userDisplayName = await window.electronAPI.storeGet('userDisplayName') || '主人';
  if (userDisplayNameInput) {
    userDisplayNameInput.value = userDisplayName;
  }
}

// 加载宠物设置
async function loadPetSettings() {
  // 加载宠物形象
  const petCharacter = await window.electronAPI.storeGet('petCharacter') || 'bubu';
  if (petCharacterSelect) {
    petCharacterSelect.value = petCharacter;
  }

  // 加载宠物大小
  const petSize = await window.electronAPI.storeGet('petSize') || 'medium';
  if (petSizeSelect) {
    petSizeSelect.value = petSize;
  }
}

// 应用主题
function applyTheme(isDarkMode) {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// 更新主题预览卡片状态
function updateThemePreview(isDarkMode) {
  if (!themePreview) return;
  
  const lightCard = themePreview.querySelector('.preview-card.light');
  const darkCard = themePreview.querySelector('.preview-card.dark');
  
  if (lightCard && darkCard) {
    lightCard.classList.toggle('active', !isDarkMode);
    darkCard.classList.toggle('active', isDarkMode);
  }
}

function applyChatTheme(theme) {
  document.body.classList.remove('theme-shiba', 'theme-blue', 'theme-purple', 'theme-green');
  if (theme !== 'shiba') {
    document.body.classList.add(`theme-${theme}`);
  }
}

// 绑定事件
function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  // 添加配置
  addConfigBtn?.addEventListener('click', () => {
    openModal();
  });

  addReminderBtn?.addEventListener('click', () => {
    openReminderModal();
  });

  closeReminderModalBtn?.addEventListener('click', closeReminderModal);
  cancelReminderBtn?.addEventListener('click', closeReminderModal);
  document.querySelector('.reminder-modal-overlay')?.addEventListener('click', closeReminderModal);

  reminderRepeatInput?.addEventListener('change', updateReminderIntervalVisibility);
  saveReminderBtn?.addEventListener('click', saveCurrentReminder);

  remindersContainer?.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const reminderId = target.dataset.id;
    if (!reminderId) return;

    if (target.classList.contains('reminder-edit-btn')) {
      const reminder = reminders.find(item => item.id === reminderId);
      if (reminder) openReminderModal(reminder);
    } else if (target.classList.contains('reminder-delete-btn')) {
      await deleteReminder(reminderId);
    }
  });

  remindersContainer?.addEventListener('change', async (event) => {
    const target = event.target;
    if (!target.classList.contains('reminder-toggle')) return;
    const reminder = reminders.find(item => item.id === target.dataset.id);
    if (!reminder) return;

    const result = await window.electronAPI.saveReminder({
      ...reminder,
      enabled: target.checked
    });
    if (result.success) {
      await loadReminders();
      showToast(target.checked ? '✅ 提醒已启用' : '⏹️ 提醒已停用', 'success');
    } else {
      target.checked = reminder.enabled;
      showToast(`❌ ${result.error}`, 'error');
    }
  });
  
  // 关闭按钮
  closeBtn?.addEventListener('click', () => {
    window.close();
  });
  
  // 置顶设置
  alwaysOnTopCheckbox?.addEventListener('change', async () => {
    await window.electronAPI.storeSet('alwaysOnTop', alwaysOnTopCheckbox.checked);
    showToast('✅ 设置已保存！生效啦~ ⚙️', 'success');
  });

  launchAtLoginCheckbox?.addEventListener('change', async () => {
    const result = await window.electronAPI.setLaunchAtLogin(launchAtLoginCheckbox.checked);
    launchAtLoginCheckbox.checked = result.enabled === true;
    launchAtLoginCheckbox.disabled = result.supported === false;
    if (result.success) {
      showToast(result.enabled ? '✅ 已开启开机自动启动' : '⏹️ 已关闭开机自动启动', 'success');
    } else {
      showToast(`❌ 开机自启设置失败：${result.error || '系统不支持'}`, 'error');
    }
  });
  
  // 宠物形象切换
  petCharacterSelect?.addEventListener('change', async () => {
    const character = petCharacterSelect.value;
    await window.electronAPI.storeSet('petCharacter', character);
    window.electronAPI.updatePetCharacter(character);

    const characterNames = { bubu: '布布', yier: '一二' };
    showToast(`🐕 宠物形象已切换为${characterNames[character]}！`, 'success');
  });
  
  // 宠物大小调整
  petSizeSelect?.addEventListener('change', async () => {
    const size = petSizeSelect.value;
    await window.electronAPI.storeSet('petSize', size);
    // 通知宠物窗口调整大小
    window.electronAPI.updatePetSize(size);
    
    const sizeNames = { small: '小', medium: '中', large: '大' };
    showToast(`🐕 宠物大小已调整为${sizeNames[size]}！`, 'success');
  });
  
  // 主题色彩选择
  themeSelect?.addEventListener('change', async () => {
    const theme = themeSelect.value;
    await window.electronAPI.storeSet('chatTheme', theme);
    applyChatTheme(theme);
    // 通知聊天窗口更新主题
    window.electronAPI.updateChatTheme(theme);
    
    const themeNames = { shiba: '松石青', blue: '天空蓝', purple: '优雅紫', green: '清新绿' };
    showToast(`🎨 主题已切换为${themeNames[theme]}！`, 'success');
  });
  
  // 字体大小调整
  fontSizeSelect?.addEventListener('change', async () => {
    const fontSize = fontSizeSelect.value;
    await window.electronAPI.storeSet('chatFontSize', fontSize);
    // 通知聊天窗口更新字体大小
    window.electronAPI.updateChatFontSize(fontSize);
    
    const sizeNames = { small: '小', medium: '中', large: '大' };
    showToast(`📝 字体大小已调整为${sizeNames[fontSize]}！`, 'success');
  });
  
  // 启动时自动打开对话窗口开关
  autoOpenChatCheckbox?.addEventListener('change', async () => {
    await window.electronAPI.storeSet('autoOpenChat', autoOpenChatCheckbox.checked);
    showToast(autoOpenChatCheckbox.checked ? '✅ 下次启动将自动打开对话窗口' : '⏹️ 已关闭自动打开对话窗口', 'success');
  });
  
  // 保存对话历史开关
  saveHistoryCheckbox?.addEventListener('change', async () => {
    await window.electronAPI.storeSet('saveHistory', saveHistoryCheckbox.checked);
    showToast(saveHistoryCheckbox.checked ? '✅ 对话历史将会自动保存' : '⏹️ 对话历史自动保存已关闭', 'success');
  });

  assistantNicknameInput?.addEventListener('change', async () => {
    const nickname = assistantNicknameInput.value.trim() || '小秘书';
    assistantNicknameInput.value = nickname;
    await window.electronAPI.storeSet('assistantNickname', nickname);
    showToast(`✅ 助手昵称已更新为「${nickname}」`, 'success');
  });

  userDisplayNameInput?.addEventListener('change', async () => {
    const displayName = userDisplayNameInput.value.trim() || '主人';
    userDisplayNameInput.value = displayName;
    await window.electronAPI.storeSet('userDisplayName', displayName);
    showToast(displayName ? `✅ 助手会称呼你为「${displayName}」` : '✅ 已恢复默认称呼「你」', 'success');
  });

  personalModeBtn?.addEventListener('click', async () => {
    applyNetworkMode('personal');
    if (networkEnabledCheckbox) networkEnabledCheckbox.checked = false;
    const state = await window.electronAPI.setPetNetworkMode('personal');
    renderNetworkState(state);
    showToast('✅ 已切换到个人版', 'success');
  });

  networkModeBtn?.addEventListener('click', async () => {
    applyNetworkMode('network');
    if (networkEnabledCheckbox) networkEnabledCheckbox.checked = true;
    const state = networkServerUrlInput?.value.trim()
      ? await window.electronAPI.updatePetNetworkConfig({
          petAppMode: 'network',
          petNetworkEnabled: true,
          petServerUrl: networkServerUrlInput.value.trim(),
          petNetworkClientToken: networkClientTokenInput?.value.trim() || '',
          petNetworkNickname: networkNicknameInput?.value.trim() || '桌宠用户'
        })
      : await window.electronAPI.setPetNetworkMode('network');
    renderNetworkState(state);
    showToast(networkServerUrlInput?.value.trim() ? '🌐 已切换到联网版并开始连接' : '🌐 已切换到联网版，请填写服务端地址', 'success');
  });

  networkSaveBtn?.addEventListener('click', () => saveNetworkSettings());
  networkConnectBtn?.addEventListener('click', async () => {
    applyNetworkMode('network');
    if (networkEnabledCheckbox) networkEnabledCheckbox.checked = true;
    await saveNetworkSettings({ connect: true });
  });
  networkDisconnectBtn?.addEventListener('click', async () => {
    const state = await window.electronAPI.disconnectPetNetwork();
    renderNetworkState(state);
    showToast('⏹️ 已断开联网服务', 'success');
  });

  window.electronAPI.onPetNetworkStateChanged?.(renderNetworkState);
  // 夜间模式切换
  darkModeToggle?.addEventListener('change', async () => {
    const isDarkMode = darkModeToggle.checked;
    await window.electronAPI.storeSet('darkMode', isDarkMode);
    applyTheme(isDarkMode);
    updateThemePreview(isDarkMode);
    
    // 通知其他窗口更新主题
    window.electronAPI.broadcastThemeChange(isDarkMode);
    
    showToast(isDarkMode ? '🌙 已切换到夜间模式，保护眼睛~ ✨' : '☀️ 已切换到日间模式，明亮清爽~ ✨', 'success');
  });
  
  // 主题预览卡片点击
  themePreview?.querySelectorAll('.preview-card').forEach(card => {
    card.addEventListener('click', async () => {
      const isDarkMode = card.classList.contains('dark');
      if (darkModeToggle) {
        darkModeToggle.checked = isDarkMode;
      }
      await window.electronAPI.storeSet('darkMode', isDarkMode);
      applyTheme(isDarkMode);
      updateThemePreview(isDarkMode);
      
      // 通知其他窗口更新主题
      window.electronAPI.broadcastThemeChange(isDarkMode);
      
      showToast(isDarkMode ? '🌙 已切换到夜间模式，保护眼睛~ ✨' : '☀️ 已切换到日间模式，明亮清爽~ ✨', 'success');
    });
  });
  
  // 模态框
  closeModalBtn?.addEventListener('click', closeModal);
  document.querySelector('.modal-overlay')?.addEventListener('click', closeModal);
  
  // 密码显示切换
  document.querySelector('.toggle-password')?.addEventListener('click', function() {
    const input = document.getElementById('api-key');
    if (input.type === 'password') {
      input.type = 'text';
      this.textContent = '🙈';
    } else {
      input.type = 'password';
      this.textContent = '👁️';
    }
  });
  
  // 提供商类型变化
  providerTypeSelect?.addEventListener('change', onProviderTypeChange);
  
  // 模型选择变化
  modelSelect?.addEventListener('change', onModelChange);
  
  // 测试配置
  testConfigBtn?.addEventListener('click', testCurrentConfig);
  
  // 保存配置
  saveConfigBtn?.addEventListener('click', saveCurrentConfig);
  
  // 卡片操作（事件委托）
  configsContainer?.addEventListener('click', async (e) => {
    const target = e.target;
    const configId = target.dataset.id;
    
    if (target.classList.contains('activate-btn')) {
      await activateConfig(configId);
    } else if (target.classList.contains('test-btn')) {
      await testConfig(configId);
    } else if (target.classList.contains('edit-btn') || target.classList.contains('edit-btn-icon')) {
      await editConfig(configId);
    } else if (target.classList.contains('delete-btn')) {
      await deleteConfig(configId);
    }
  });

  window.electronAPI.onRemindersChanged?.(loadReminders);
}

function updateReminderIntervalVisibility() {
  reminderIntervalRow?.classList.toggle('hidden', reminderRepeatInput?.value !== 'interval');
}

function areRecurrencesEqual(left = {}, right = {}) {
  const leftFrequency = left.frequency || 'none';
  const rightFrequency = right.frequency || 'none';
  if (leftFrequency !== rightFrequency) return false;
  if (leftFrequency !== 'interval') return true;
  return Number(left.intervalValue || 1) === Number(right.intervalValue || 1)
    && (left.intervalUnit || 'days') === (right.intervalUnit || 'days');
}

function openReminderModal(reminder = null) {
  editingReminderId = reminder?.id || null;
  reminderModalTitle.textContent = reminder ? '编辑提醒' : '添加提醒';
  reminderTitleInput.value = reminder?.title || '';
  reminderNoteInput.value = reminder?.note || '';
  reminderTimeInput.value = toDateTimeLocalValue(reminder?.scheduledAt);
  reminderRepeatInput.value = reminder?.recurrence?.frequency || 'none';
  reminderIntervalValueInput.value = reminder?.recurrence?.intervalValue || 1;
  reminderIntervalUnitInput.value = reminder?.recurrence?.intervalUnit || 'days';
  updateReminderIntervalVisibility();
  reminderEnabledInput.checked = reminder?.enabled !== false;
  reminderModal.classList.remove('hidden');
  reminderTitleInput.focus();
}

function closeReminderModal() {
  reminderModal?.classList.add('hidden');
  editingReminderId = null;
}

async function saveCurrentReminder() {
  const title = reminderTitleInput.value.trim();
  const scheduledAtValue = reminderTimeInput.value;

  if (!title || !scheduledAtValue) {
    showToast('📝 请填写提醒标题和时间', 'info');
    return;
  }

  const existing = reminders.find(reminder => reminder.id === editingReminderId);
  const scheduledAt = new Date(scheduledAtValue).toISOString();
  const recurrence = {
    frequency: reminderRepeatInput.value
  };
  if (recurrence.frequency === 'interval') {
    recurrence.intervalValue = Math.max(1, Math.floor(Number(reminderIntervalValueInput.value || 1)));
    recurrence.intervalUnit = reminderIntervalUnitInput.value;
  }
  const reminder = {
    ...(existing || {}),
    id: editingReminderId || undefined,
    title,
    note: reminderNoteInput.value.trim(),
    scheduledAt,
    recurrence,
    enabled: reminderEnabledInput.checked,
    status: existing?.scheduledAt !== scheduledAt
        || !areRecurrencesEqual(existing?.recurrence, recurrence)
        || existing?.status === 'acknowledged'
      ? 'scheduled'
      : existing?.status
  };

  const result = await window.electronAPI.saveReminder(reminder);
  if (!result.success) {
    showToast(`❌ ${result.error}`, 'error');
    return;
  }

  await loadReminders();
  closeReminderModal();
  showToast('✅ 提醒已保存，到点会让宠物发气泡', 'success');
}

async function deleteReminder(id) {
  if (!confirm('确定要删除这个提醒吗？')) return;
  const result = await window.electronAPI.deleteReminder(id);
  if (result.success) {
    await loadReminders();
    showToast('✅ 提醒已删除', 'success');
  } else {
    showToast('❌ 删除失败，提醒可能已经不存在', 'error');
  }
}

// 打开模态框
function openModal(config = null) {
  editingConfigId = config?.id || null;
  
  if (config) {
    modalTitle.textContent = '编辑配置';
    configNameInput.value = config.name;
    providerTypeSelect.value = 'custom';
    apiUrlInput.value = config.apiUrl;
    apiKeyInput.value = config.apiKey;
    modelSelect.value = config.selectedModel || '';
    enabledCheckbox.checked = config.enabled !== false;
  } else {
    modalTitle.textContent = '添加配置';
    configNameInput.value = '';
    providerTypeSelect.value = 'custom';
    apiUrlInput.value = '';
    apiKeyInput.value = '';
    modelSelect.value = '';
    enabledCheckbox.checked = true;
  }
  
  modelInfo.classList.remove('show');
  testResult.classList.add('hidden');
  modal.classList.remove('hidden');
}

// 关闭模态框
function closeModal() {
  modal.classList.add('hidden');
  editingConfigId = null;
}

// 提供商类型变化
function onProviderTypeChange() {
  const template = appConfig.providerTemplates.custom;
  if (!editingConfigId || !apiUrlInput.value.trim()) {
    apiUrlInput.value = template.defaultApiUrl;
  }
  onModelChange();
}

// 模型选择变化
function onModelChange() {
  modelInfo.classList.remove('show');
}

// 获取当前选择的模型 ID
function getSelectedModel() {
  return modelSelect.value.trim() || null;
}

// 测试当前配置
async function testCurrentConfig() {
  const selectedModel = getSelectedModel();
  const config = {
    provider: providerTypeSelect.value || 'custom',
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    selectedModel: selectedModel
  };
  
  if (!config.provider || !config.apiUrl || !config.apiKey) {
    showTestResult(false, '📝 嗯...还有一些必填项没填呢~ 请把所有带 * 号的项目都填上吧！');
    return;
  }
  
  if (!config.selectedModel) {
    showTestResult(false, '📝 请填写模型 ID~');
    return;
  }
  
  testConfigBtn.disabled = true;
  testConfigBtn.textContent = '🔍 测试中...';
  testResult.classList.add('hidden');
  
  try {
    const result = await window.electronAPI.testApiConfig(config);
    
    if (result.success) {
      showTestResult(true, result.message);
    } else {
      showTestResult(false, result.error);
    }
  } catch (error) {
    showTestResult(false, '😔 测试时遇到了小问题...\n\n' + error.message);
  } finally {
    testConfigBtn.disabled = false;
    testConfigBtn.textContent = '🔍 测试连接';
  }
}

// 显示测试结果
function showTestResult(success, message) {
  testResult.textContent = message;
  testResult.className = `test-result ${success ? 'success' : 'error'}`;
}

// 保存当前配置
async function saveCurrentConfig() {
  const selectedModel = getSelectedModel();
  const config = {
    name: configNameInput.value.trim(),
    provider: providerTypeSelect.value || 'custom',
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    selectedModel: selectedModel,
    enabled: enabledCheckbox.checked
  };
  
  if (!config.name || !config.provider || !config.apiUrl || !config.apiKey) {
    showToast('📝 嗯...还有一些必填项没填呢~ 请把所有带 * 号的项目都填上吧！', 'info');
    return;
  }
  
  if (!config.selectedModel) {
    showToast('📝 请填写模型 ID~', 'info');
    return;
  }
  
  try {
    if (editingConfigId) {
      // 更新
      await window.electronAPI.updateApiConfig(editingConfigId, config);
      showToast('✅ 配置更新完成！现在更好用了~ ⚙️', 'success');
    } else {
      // 新增
      await window.electronAPI.addApiConfig(config);
      showToast('✅ 配置保存成功！可以开始使用啦~ 🎉', 'success');
    }
    
    await loadConfigs();
    closeModal();
  } catch (error) {
    showToast('😔 保存时遇到了小问题: ' + error.message, 'error');
  }
}

// 激活配置
async function activateConfig(id) {
  await window.electronAPI.setActiveConfig(id);
  const activeConfig = await window.electronAPI.getActiveConfig();
  renderConfigs(activeConfig?.id);
  showToast('✅ 配置已切换！准备好和新伙伴聊天了~ 💬', 'success');
}

// 测试配置
async function testConfig(id) {
  const config = apiConfigs.find(c => c.id === id);
  if (!config) return;
  
  showToast('🔍 正在测试连接...', 'info');
  
  try {
    const result = await window.electronAPI.testApiConfig(config);
    
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.error, 'error');
    }
  } catch (error) {
    showToast('😔 测试时遇到了小问题: ' + error.message, 'error');
  }
}

// 编辑配置
async function editConfig(id) {
  const config = apiConfigs.find(c => c.id === id);
  if (config) {
    openModal(config);
  }
}

// 删除配置
async function deleteConfig(id) {
  if (!confirm('确定要删除这个配置吗？\n\n删除后就找不回来了哦~ 🗑️')) return;
  
  try {
    await window.electronAPI.deleteApiConfig(id);
    await loadConfigs();
    showToast('✅ 配置已删除~ 拜拜啦！👋', 'success');
  } catch (error) {
    showToast('😔 删除时遇到了小问题: ' + error.message, 'error');
  }
}

// 显示Toast提示
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  const duration = type === 'error' ? 3000 : 1500;
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// 初始化应用
initialize();
