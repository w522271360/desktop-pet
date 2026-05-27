// 设置页面 - 侧边栏导航版本（支持MCP）
let appConfig = null;
let apiConfigs = [];
let editingConfigId = null;

// MCP 相关
let mcpServers = [];
let editingMcpServerId = null;
let connectedServers = [];
let reminders = [];
let editingReminderId = null;

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
const reminderEnabledInput = document.getElementById('reminder-enabled-input');
const cancelReminderBtn = document.getElementById('cancel-reminder-btn');
const saveReminderBtn = document.getElementById('save-reminder-btn');

// DOM元素 - 通用设置
const alwaysOnTopCheckbox = document.getElementById('always-on-top');

// DOM元素 - 外观设置
const darkModeToggle = document.getElementById('dark-mode-toggle');
const themePreview = document.getElementById('theme-preview');

// DOM元素 - 桌面宠物设置
const resetPetImageBtn = document.getElementById('reset-pet-image');
const petSizeSelect = document.getElementById('pet-size');
const petImageDesc = document.querySelector('#reset-pet-image')?.closest('.setting-item')?.querySelector('.setting-desc');

// DOM元素 - 对话界面设置
const themeSelect = document.getElementById('theme-select');
const fontSizeSelect = document.getElementById('font-size');

// DOM元素 - 对话设置
const autoOpenChatCheckbox = document.getElementById('auto-open-chat');
const saveHistoryCheckbox = document.getElementById('save-history');
const markdownPathInput = document.getElementById('markdown-path');
const changePathBtn = document.getElementById('change-path-btn');
const assistantNicknameInput = document.getElementById('assistant-nickname');
const userDisplayNameInput = document.getElementById('user-display-name');

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
const customModelGroup = document.getElementById('custom-model-group');
const customModelInput = document.getElementById('custom-model-input');
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
  appConfig = await window.electronAPI.getConfig();
  await loadConfigs();
  await loadReminders();
  await loadSettings();
  bindEvents();
  bindProxyEvents();
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
  const provider = config.provider || config.providerType;
  const template = appConfig.providerTemplates[provider];
  const modelData = template?.models.find(m => m.id === config.selectedModel);
  
  const card = document.createElement('div');
  card.className = `config-card ${isActive ? 'active' : ''} ${!config.enabled ? 'disabled' : ''}`;
  
  // 使用品牌图标
  const iconClass = template?.icon || 'custom';
  
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <span class="provider-icon ${iconClass}" data-provider="${provider}"></span>
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
        <div class="field-value">${modelData?.name || config.selectedModel}</div>
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
  const card = document.createElement('div');
  card.className = `reminder-card ${reminder.enabled ? '' : 'disabled'} ${isDue ? 'due' : ''}`;
  card.innerHTML = `
    <div class="reminder-card-main">
      <div class="reminder-card-title">
        <span>${escapeHtml(reminder.title)}</span>
        ${isDue ? '<span class="card-badge active">待确认</span>' : ''}
        ${isAcknowledged ? '<span class="card-badge disabled">已确认</span>' : ''}
        ${!reminder.enabled ? '<span class="card-badge disabled">已停用</span>' : ''}
      </div>
      ${reminder.note ? `<div class="reminder-card-note">${escapeHtml(reminder.note)}</div>` : ''}
      <div class="reminder-card-time">${formatReminderDateTime(reminder.scheduledAt)}</div>
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
  const alwaysOnTop = await window.electronAPI.storeGet('alwaysOnTop') || false;
  alwaysOnTopCheckbox.checked = alwaysOnTop;
  
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

// 加载对话界面设置
async function loadChatSettings() {
  // 加载主题色彩
  const theme = await window.electronAPI.storeGet('chatTheme') || 'shiba';
  if (themeSelect) {
    themeSelect.value = theme;
  }
  
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

  const userDisplayName = await window.electronAPI.storeGet('userDisplayName') || '';
  if (userDisplayNameInput) {
    userDisplayNameInput.value = userDisplayName;
  }
  
  // 加载工作目录（沿用旧存储键以兼容已有配置）
  const markdownPath = await window.electronAPI.storeGet('markdownPath') || '';
  if (markdownPathInput) {
    markdownPathInput.value = markdownPath;
  }
  
}

// 加载宠物设置
async function loadPetSettings() {
  // 加载宠物大小
  const petSize = await window.electronAPI.storeGet('petSize') || 'medium';
  if (petSizeSelect) {
    petSizeSelect.value = petSize;
  }
  
  // 更新宠物图片描述
  const petImagePath = await window.electronAPI.storeGet('petImagePath');
  if (petImageDesc) {
    if (petImagePath) {
      const fileName = petImagePath.split(/[/\\]/).pop();
      petImageDesc.textContent = `当前使用：${fileName}（可拖拽图片到宠物上更换）`;
    } else {
      petImageDesc.textContent = '当前使用：柴犬照片（可拖拽图片到宠物上更换）';
    }
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

// 绑定事件
function bindEvents() {
  // 添加配置
  addConfigBtn.addEventListener('click', () => {
    openModal();
  });

  addReminderBtn?.addEventListener('click', () => {
    openReminderModal();
  });

  closeReminderModalBtn?.addEventListener('click', closeReminderModal);
  cancelReminderBtn?.addEventListener('click', closeReminderModal);
  document.querySelector('.reminder-modal-overlay')?.addEventListener('click', closeReminderModal);

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
  closeBtn.addEventListener('click', () => {
    window.close();
  });
  
  // 置顶设置
  alwaysOnTopCheckbox.addEventListener('change', async () => {
    await window.electronAPI.storeSet('alwaysOnTop', alwaysOnTopCheckbox.checked);
    showToast('✅ 设置已保存！生效啦~ ⚙️', 'success');
  });
  
  // 重置宠物图片
  resetPetImageBtn?.addEventListener('click', async () => {
    await window.electronAPI.storeSet('petImagePath', '');
    // 通知宠物窗口更新
    window.electronAPI.updatePetImage('');
    // 更新描述
    if (petImageDesc) {
      petImageDesc.textContent = '当前使用：柴犬照片（可拖拽图片到宠物上更换）';
    }
    showToast('🐕 宠物图片已重置为默认柴犬！', 'success');
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
    // 通知聊天窗口更新主题
    window.electronAPI.updateChatTheme(theme);
    
    const themeNames = { shiba: '柴犬橙', blue: '天空蓝', purple: '优雅紫', green: '清新绿' };
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
    const displayName = userDisplayNameInput.value.trim();
    userDisplayNameInput.value = displayName;
    await window.electronAPI.storeSet('userDisplayName', displayName);
    showToast(displayName ? `✅ 助手会称呼你为「${displayName}」` : '✅ 已恢复默认称呼「你」', 'success');
  });
  
  // 选择工作目录
  changePathBtn?.addEventListener('click', async () => {
    const result = await window.electronAPI.selectDirectory();
    if (result.success) {
      markdownPathInput.value = result.path;
      await window.electronAPI.storeSet('markdownPath', result.path);
      showToast('📁 工作目录已设置，可以开始使用啦！', 'success');
    }
  });
  
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
  closeModalBtn.addEventListener('click', closeModal);
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
  providerTypeSelect.addEventListener('change', onProviderTypeChange);
  
  // 模型选择变化
  modelSelect.addEventListener('change', onModelChange);
  
  // 测试配置
  testConfigBtn.addEventListener('click', testCurrentConfig);
  
  // 保存配置
  saveConfigBtn.addEventListener('click', saveCurrentConfig);
  
  // 卡片操作（事件委托）
  configsContainer.addEventListener('click', async (e) => {
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

function openReminderModal(reminder = null) {
  editingReminderId = reminder?.id || null;
  reminderModalTitle.textContent = reminder ? '编辑提醒' : '添加提醒';
  reminderTitleInput.value = reminder?.title || '';
  reminderNoteInput.value = reminder?.note || '';
  reminderTimeInput.value = toDateTimeLocalValue(reminder?.scheduledAt);
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
  const reminder = {
    ...(existing || {}),
    id: editingReminderId || undefined,
    title,
    note: reminderNoteInput.value.trim(),
    scheduledAt,
    enabled: reminderEnabledInput.checked,
    status: existing?.scheduledAt !== scheduledAt || existing?.status === 'acknowledged'
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
    providerTypeSelect.value = config.provider || config.providerType || 'custom';
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
  if (modelSelect?.tagName === 'INPUT') return;
  const provider = providerTypeSelect.value;
  
  if (!provider) {
    modelSelect.innerHTML = '<option value="">请先选择提供商类型</option>';
    apiUrlInput.value = '';
    modelInfo.classList.remove('show');
    customModelGroup?.classList.add('hidden');
    return;
  }
  
  const template = appConfig.providerTemplates[provider];
  
  // 只有在新建模式（非编辑）或当前 URL 为空时才设置默认 URL
  // 编辑模式下保留用户已保存的 API 地址
  if (!editingConfigId || !apiUrlInput.value.trim()) {
    apiUrlInput.value = template.defaultApiUrl;
  }
  
  // 隐藏自定义输入框（默认）
  customModelGroup?.classList.add('hidden');
  modelSelect.style.display = '';
  
  // 填充模型列表
  modelSelect.innerHTML = '';
  template.models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    
    // 特殊处理自定义输入选项
    if (model.isCustomInput) {
      option.textContent = model.name;
      option.dataset.customInput = 'true';
    } else {
      option.textContent = model.name + (model.recommended ? ' ⭐' : '');
    }
    
    modelSelect.appendChild(option);
  });
  
  modelSelect.value = template.defaultModel;
  onModelChange();
}

// 模型选择变化
function onModelChange() {
  if (modelSelect?.tagName === 'INPUT') {
    modelInfo.classList.remove('show');
    return;
  }
  const provider = providerTypeSelect.value;
  const template = appConfig.providerTemplates[provider];
  const modelId = modelSelect.value;
  
  if (!provider || !modelId) {
    modelInfo.classList.remove('show');
    customModelGroup?.classList.add('hidden');
    return;
  }
  
  // 检查是否选择了"手动输入"选项
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const isCustomInputSelected = selectedOption?.dataset.customInput === 'true';
  
  if (isCustomInputSelected) {
    // 显示自定义输入框
    customModelGroup?.classList.remove('hidden');
    if (customModelInput) {
      customModelInput.placeholder = '输入您的模型 ID，如 gpt-4o-2024-08-06';
      customModelInput.focus();
    }
    modelInfo.innerHTML = `
      <strong>💡 手动输入说明：</strong><br>
      • 输入您的中转站支持的任意模型 ID<br>
      • 模型 ID 区分大小写，请确保拼写正确
    `;
    modelInfo.classList.add('show');
    return;
  }
  
  // 隐藏自定义输入框
  customModelGroup?.classList.add('hidden');
  
  const model = template?.models.find(m => m.id === modelId);
  
  if (model) {
    let info = model.description || '';
    if (model.contextLength) info += `<br>上下文: ${model.contextLength}`;
    if (model.maxOutput) info += ` | 输出: ${model.maxOutput}`;
    
    modelInfo.innerHTML = info;
    modelInfo.classList.add('show');
  } else {
    modelInfo.classList.remove('show');
  }
}

// 获取当前选择的模型 ID
function getSelectedModel() {
  if (modelSelect?.tagName === 'INPUT') {
    return modelSelect.value.trim() || null;
  }
  const modelId = modelSelect.value;
  
  // 检查是否选择了"手动输入"选项
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const isCustomInputSelected = selectedOption?.dataset.customInput === 'true';
  
  if (isCustomInputSelected && customModelInput) {
    const customValue = customModelInput.value.trim();
    if (!customValue) {
      return null; // 返回 null 表示未填写
    }
    return customValue;
  }
  
  return modelId;
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
  
  // 检查是否选择了手动输入但没填写
  const selectedOption = modelSelect.options?.[modelSelect.selectedIndex];
  const isCustomInputSelected = selectedOption?.dataset.customInput === 'true';
  
  if (!config.provider || !config.apiUrl || !config.apiKey) {
    showTestResult(false, '📝 嗯...还有一些必填项没填呢~ 请把所有带 * 号的项目都填上吧！');
    return;
  }
  
  if (!config.selectedModel) {
    if (isCustomInputSelected) {
      showTestResult(false, '📝 您选择了手动输入模型，请在下方输入框填写模型 ID~');
    } else {
      showTestResult(false, '📝 请选择一个模型~');
    }
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
  
  // 检查是否选择了手动输入但没填写
  const selectedOption = modelSelect.options?.[modelSelect.selectedIndex];
  const isCustomInputSelected = selectedOption?.dataset.customInput === 'true';
  
  if (!config.name || !config.provider || !config.apiUrl || !config.apiKey) {
    showToast('📝 嗯...还有一些必填项没填呢~ 请把所有带 * 号的项目都填上吧！', 'info');
    return;
  }
  
  if (!config.selectedModel) {
    if (isCustomInputSelected) {
      showToast('📝 您选择了手动输入模型，请在下方输入框填写模型 ID~', 'info');
    } else {
      showToast('📝 请选择一个模型~', 'info');
    }
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
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ========== MCP 相关功能 ==========

// MCP DOM 元素
const mcpEnabledCheckbox = document.getElementById('mcp-enabled');
const mcpServersContainer = document.getElementById('mcp-servers-container');
const addMcpServerBtn = document.getElementById('add-mcp-server-btn');
const mcpModal = document.getElementById('mcp-modal');
const closeMcpModalBtn = document.getElementById('close-mcp-modal-btn');
const mcpServerNameInput = document.getElementById('mcp-server-name');
const mcpCommandInput = document.getElementById('mcp-command');
const mcpArgsInput = document.getElementById('mcp-args');
const mcpEnvInput = document.getElementById('mcp-env');
const mcpEnabledCheckboxModal = document.getElementById('mcp-enabled-checkbox');
const testMcpBtn = document.getElementById('test-mcp-btn');
const saveMcpBtn = document.getElementById('save-mcp-btn');
const mcpTestResult = document.getElementById('mcp-test-result');

// MCP 预设配置 - 使用官方验证过的包名
const mcpPresets = {
  filesystem: {
    name: '文件系统',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-filesystem C:/',
    env: '',
    description: '读取、写入、搜索本地文件（14个工具）'
  },
  memory: {
    name: '记忆存储',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-memory',
    env: '',
    description: '让 AI 记住重要信息（9个工具）'
  },
  puppeteer: {
    name: '浏览器自动化',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-puppeteer',
    env: '',
    description: '控制浏览器、截图、爬取网页'
  }
};

// 加载 MCP 服务器列表
async function loadMcpServers() {
  mcpServers = await window.electronAPI.getMcpServers();
  connectedServers = await window.electronAPI.getConnectedMcpServers();
  
  const mcpEnabled = await window.electronAPI.storeGet('mcpEnabled') || false;
  mcpEnabledCheckbox.checked = mcpEnabled;
  
  renderMcpServers();
}

// 渲染 MCP 服务器卡片（新样式：类似 Cursor 的 MCP 列表）
function renderMcpServers() {
  if (!mcpServersContainer) return;
  
  mcpServersContainer.innerHTML = '';
  
  if (mcpServers.length === 0) {
    mcpServersContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🛠️</span>
        <p>还没有添加 MCP 服务器</p>
        <p class="empty-hint">点击上方按钮添加，或使用下方预设快速添加</p>
      </div>
    `;
    return;
  }
  
  mcpServers.forEach(server => {
    const isConnected = connectedServers.some(s => s.id === server.id);
    const card = createMcpServerCard(server, isConnected);
    mcpServersContainer.appendChild(card);
  });
}

// 创建 MCP 服务器卡片（新样式）
function createMcpServerCard(server, isConnected) {
  const card = document.createElement('div');
  card.className = 'mcp-server-item';
  
  const connectedInfo = connectedServers.find(s => s.id === server.id);
  const toolCount = connectedInfo?.toolCount || 0;
  
  // 确定状态文本
  let statusText = '';
  let statusClass = '';
  if (server.enabled) {
    if (isConnected) {
      statusText = `${toolCount} 个工具可用`;
      statusClass = 'connected';
    } else {
      statusText = 'Loading tools';
      statusClass = 'loading';
    }
  } else {
    statusText = '已禁用';
    statusClass = 'disabled';
  }
  
  card.innerHTML = `
    <div class="mcp-item-icon">🛠</div>
    <div class="mcp-item-info">
      <div class="mcp-item-name">${server.name}</div>
      <div class="mcp-item-status ${statusClass}">
        ${statusClass === 'loading' ? '<span class="status-dot"></span>' : ''}
        ${statusText}
      </div>
    </div>
    <div class="mcp-item-actions">
      <button class="mcp-action-btn edit-mcp-btn" data-id="${server.id}" title="编辑">✏️</button>
      <button class="mcp-action-btn delete-mcp-btn" data-id="${server.id}" title="删除">🗑️</button>
    </div>
    <label class="switch mcp-switch">
      <input type="checkbox" class="mcp-toggle" data-id="${server.id}" ${server.enabled ? 'checked' : ''}>
      <span class="slider"></span>
    </label>
  `;
  
  return card;
}

// 绑定 MCP 事件
function bindMcpEvents() {
  // MCP 功能开关
  mcpEnabledCheckbox?.addEventListener('change', async () => {
    await window.electronAPI.toggleMcp(mcpEnabledCheckbox.checked);
    showToast(mcpEnabledCheckbox.checked ? '✅ MCP 功能已启用！AI 现在可以使用工具了~ 🛠️' : '⏸️ MCP 功能已关闭', 'success');
  });
  
  // 添加 MCP 服务器
  addMcpServerBtn?.addEventListener('click', () => {
    openMcpModal();
  });
  
  // 关闭模态框
  closeMcpModalBtn?.addEventListener('click', closeMcpModal);
  document.querySelectorAll('.modal-overlay')[1]?.addEventListener('click', closeMcpModal);
  
  // 测试连接
  testMcpBtn?.addEventListener('click', testMcpServer);
  
  // 保存服务器
  saveMcpBtn?.addEventListener('click', saveMcpServer);
  
  // 预设按钮
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = mcpPresets[btn.dataset.preset];
      if (preset) {
        openMcpModal({
          name: preset.name,
          command: preset.command,
          args: preset.args.split(' '),
          env: preset.env ? JSON.parse(preset.env) : {},
          enabled: false
        });
      }
    });
  });
  
  // MCP 服务器操作（事件委托）
  mcpServersContainer?.addEventListener('click', async (e) => {
    const target = e.target;
    const serverId = target.dataset.id;
    
    if (target.classList.contains('edit-mcp-btn')) {
      editMcpServer(serverId);
    } else if (target.classList.contains('delete-mcp-btn')) {
      await deleteMcpServer(serverId);
    }
  });
  
  // MCP 开关（事件委托）
  mcpServersContainer?.addEventListener('change', async (e) => {
    const target = e.target;
    if (target.classList.contains('mcp-toggle')) {
      const serverId = target.dataset.id;
      const enabled = target.checked;
      await toggleMcpServer(serverId, enabled);
    }
  });
}

// 切换 MCP 服务器启用状态
async function toggleMcpServer(serverId, enabled) {
  const server = mcpServers.find(s => s.id === serverId);
  if (!server) return;
  
  try {
    // 更新服务器配置
    await window.electronAPI.updateMcpServer(serverId, { enabled });
    
    if (enabled) {
      // 启用时尝试连接
      showToast(`🔄 正在连接 ${server.name}...`, 'info');
      const result = await window.electronAPI.connectMcpServer({ ...server, enabled: true });
      
      if (result.success) {
        showToast(`✅ ${server.name} 已连接！${result.tools?.length || 0} 个工具可用`, 'success');
      } else {
        showToast(`⚠️ ${server.name} 已启用但连接失败：${result.error}`, 'error');
      }
    } else {
      // 禁用时断开连接
      if (connectedServers.some(s => s.id === serverId)) {
        await window.electronAPI.disconnectMcpServer(serverId);
      }
      showToast(`⏸️ ${server.name} 已禁用`, 'info');
    }
    
    await loadMcpServers();
  } catch (error) {
    showToast(`❌ 操作失败：${error.message}`, 'error');
    await loadMcpServers(); // 刷新状态
  }
}

// 打开 MCP 模态框
function openMcpModal(server = null) {
  editingMcpServerId = server?.id || null;
  
  const modalTitle = document.getElementById('mcp-modal-title');
  
  if (server) {
    modalTitle.textContent = editingMcpServerId ? '✏️ 编辑 MCP 服务器' : '🛠️ 添加 MCP 服务器';
    mcpServerNameInput.value = server.name || '';
    mcpCommandInput.value = server.command || '';
    mcpArgsInput.value = Array.isArray(server.args) ? server.args.join(' ') : (server.args || '');
    mcpEnvInput.value = server.env ? JSON.stringify(server.env, null, 2) : '';
    mcpEnabledCheckboxModal.checked = server.enabled !== false;
  } else {
    modalTitle.textContent = '🛠️ 添加 MCP 服务器';
    mcpServerNameInput.value = '';
    mcpCommandInput.value = '';
    mcpArgsInput.value = '';
    mcpEnvInput.value = '';
    mcpEnabledCheckboxModal.checked = false;
  }
  
  mcpTestResult?.classList.add('hidden');
  mcpModal?.classList.remove('hidden');
}

// 关闭 MCP 模态框
function closeMcpModal() {
  mcpModal?.classList.add('hidden');
  editingMcpServerId = null;
}

// 测试 MCP 服务器
async function testMcpServer() {
  const serverConfig = {
    id: editingMcpServerId || 'test-' + Date.now(),
    name: mcpServerNameInput.value.trim(),
    command: mcpCommandInput.value.trim(),
    args: mcpArgsInput.value.trim().split(/\s+/).filter(Boolean),
    env: mcpEnvInput.value.trim() ? JSON.parse(mcpEnvInput.value.trim()) : {},
    enabled: true
  };
  
  if (!serverConfig.name || !serverConfig.command) {
    showMcpTestResult(false, '请填写服务器名称和启动命令~');
    return;
  }
  
  testMcpBtn.disabled = true;
  testMcpBtn.textContent = '⏳ 连接中...';
  
  // 显示加载状态
  if (mcpTestResult) {
    mcpTestResult.textContent = '正在连接 MCP 服务器，首次使用需要下载依赖（约30秒）...';
    mcpTestResult.className = 'test-result-area loading';
  }
  
  try {
    const result = await window.electronAPI.connectMcpServer(serverConfig);
    
    if (result.success) {
      showMcpTestResult(true, `连接成功！${result.message}\n\n发现 ${result.tools?.length || 0} 个可用工具`);
      
      // 断开测试连接
      if (!editingMcpServerId) {
        await window.electronAPI.disconnectMcpServer(serverConfig.id);
      }
    } else {
      showMcpTestResult(false, `连接失败：${result.error}`);
    }
  } catch (error) {
    showMcpTestResult(false, `出错了：${error.message}`);
  } finally {
    testMcpBtn.disabled = false;
    testMcpBtn.textContent = '🔍 测试连接';
  }
}

// 显示 MCP 测试结果
function showMcpTestResult(success, message) {
  if (mcpTestResult) {
    // 移除之前的 ::before 内容设置的前缀
    const cleanMessage = message.replace(/^[✅❌⏳]\s*/, '');
    mcpTestResult.textContent = cleanMessage;
    mcpTestResult.className = `test-result-area ${success ? 'success' : 'error'}`;
  }
}

// 保存 MCP 服务器
async function saveMcpServer() {
  const serverConfig = {
    name: mcpServerNameInput.value.trim(),
    command: mcpCommandInput.value.trim(),
    args: mcpArgsInput.value.trim().split(/\s+/).filter(Boolean),
    env: mcpEnvInput.value.trim() ? JSON.parse(mcpEnvInput.value.trim()) : {},
    enabled: mcpEnabledCheckboxModal.checked
  };
  
  if (!serverConfig.name || !serverConfig.command) {
    showToast('📝 请填写服务器名称和启动命令~', 'info');
    return;
  }
  
  try {
    if (editingMcpServerId) {
      await window.electronAPI.updateMcpServer(editingMcpServerId, serverConfig);
      showToast('✅ 服务器配置已更新！', 'success');
    } else {
      await window.electronAPI.addMcpServer(serverConfig);
      showToast('✅ 服务器已添加！', 'success');
    }
    
    await loadMcpServers();
    closeMcpModal();
  } catch (error) {
    showToast(`❌ 保存失败：${error.message}`, 'error');
  }
}

// 连接 MCP 服务器
async function connectMcpServer(serverId) {
  const server = mcpServers.find(s => s.id === serverId);
  if (!server) return;
  
  showToast('🔄 正在连接...', 'info');
  
  try {
    const result = await window.electronAPI.connectMcpServer(server);
    
    if (result.success) {
      showToast(`✅ ${server.name} 连接成功！获取到 ${result.tools?.length || 0} 个工具`, 'success');
      await loadMcpServers();
    } else {
      showToast(`❌ 连接失败：${result.error}`, 'error');
    }
  } catch (error) {
    showToast(`❌ 出错了：${error.message}`, 'error');
  }
}

// 断开 MCP 服务器
async function disconnectMcpServer(serverId) {
  try {
    const result = await window.electronAPI.disconnectMcpServer(serverId);
    
    if (result.success) {
      showToast('✅ 已断开连接', 'success');
      await loadMcpServers();
    } else {
      showToast(`❌ 断开失败：${result.error}`, 'error');
    }
  } catch (error) {
    showToast(`❌ 出错了：${error.message}`, 'error');
  }
}

// 编辑 MCP 服务器
function editMcpServer(serverId) {
  const server = mcpServers.find(s => s.id === serverId);
  if (server) {
    openMcpModal(server);
  }
}

// 删除 MCP 服务器
async function deleteMcpServer(serverId) {
  if (!confirm('确定要删除这个 MCP 服务器吗？')) return;
  
  try {
    // 先断开连接
    if (connectedServers.some(s => s.id === serverId)) {
      await window.electronAPI.disconnectMcpServer(serverId);
    }
    
    await window.electronAPI.deleteMcpServer(serverId);
    await loadMcpServers();
    showToast('✅ 服务器已删除', 'success');
  } catch (error) {
    showToast(`❌ 删除失败：${error.message}`, 'error');
  }
}

// ========== Gemini API 中转站相关功能 ==========

// 中转站 DOM 元素
const proxyEnabledCheckbox = document.getElementById('proxy-enabled');
const autoSyncConfigsCheckbox = document.getElementById('auto-sync-configs');
const proxyPortInput = document.getElementById('proxy-port');
const proxyStatus = document.getElementById('proxy-status');
const geminiKeyInput = document.getElementById('gemini-key-input');
const addGeminiKeyBtn = document.getElementById('add-gemini-key');
const allGeminiKeysList = document.getElementById('all-gemini-keys-list');
const manualGeminiKeysList = document.getElementById('manual-gemini-keys-list');

// 中转站配置
let proxyConfig = {
  enabled: false,
  port: 3001,
  geminiKeys: [],
  autoSyncApiConfigs: true
};

// 所有 Gemini Keys（包括 API 配置中同步的）
let allGeminiKeys = [];

// 加载中转站配置
async function loadProxyConfig() {
  proxyConfig = await window.electronAPI.getProxyConfig();
  allGeminiKeys = await window.electronAPI.getAllGeminiKeys();
  
  if (proxyEnabledCheckbox) {
    proxyEnabledCheckbox.checked = proxyConfig.enabled;
  }
  
  if (autoSyncConfigsCheckbox) {
    autoSyncConfigsCheckbox.checked = proxyConfig.autoSyncApiConfigs !== false;
  }
  
  if (proxyPortInput) {
    proxyPortInput.value = proxyConfig.port || 3001;
  }
  
  renderAllGeminiKeys();
  renderManualGeminiKeys();
  await updateProxyStatus();
}

// 状态刷新定时器
let proxyStatusTimer = null;

// 更新中转站状态显示（增强版）
async function updateProxyStatus() {
  const statusPanel = document.getElementById('proxy-status-panel');
  const statusDetails = document.getElementById('proxy-status-details');
  if (!statusPanel) return;
  
  try {
    const status = await window.electronAPI.getProxyStatus();
    
    const statusDot = statusPanel.querySelector('.status-dot');
    const statusText = statusPanel.querySelector('.status-text');
    
    if (status.running) {
      statusPanel.classList.add('running');
      statusPanel.classList.remove('error', 'warning');
      statusDetails?.classList.remove('hidden');
      
      // 根据健康度设置样式
      if (status.healthLevel === 'critical') {
        statusPanel.classList.add('error');
        statusText.textContent = `⚠️ 服务异常 - 所有 Key 不可用`;
      } else if (status.healthLevel === 'warning') {
        statusPanel.classList.add('warning');
        statusText.textContent = `⚡ 运行中 - ${status.available}/${status.total} 个 Key 可用`;
      } else {
        statusText.textContent = `✅ 运行中 - ${status.available}/${status.total} 个 Key 可用`;
      }
      
      // 更新统计数据
      updateStatusStats(status);
      
      // 更新健康度指示
      updateHealthIndicator(status);
      
      // 更新下次恢复时间
      updateNextRecovery(status);
      
      // 用运行时数据更新 Key 列表
      if (status.keys) {
        updateKeysWithStatus(status.keys);
      }
      
    } else {
      statusPanel.classList.remove('running', 'error', 'warning');
      statusDetails?.classList.add('hidden');
      statusText.textContent = '未启动';
    }
  } catch (error) {
    const statusText = statusPanel?.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = '状态获取失败';
    }
    console.error('获取中转站状态失败:', error);
  }
  
  // 更新 URL 显示（使用 127.0.0.1 避免 IPv6 问题）
  const proxyUrl = document.getElementById('proxy-url');
  if (proxyUrl) {
    proxyUrl.textContent = `http://127.0.0.1:${proxyConfig.port}/v1`;
  }
}

// 更新统计数据
function updateStatusStats(status) {
  const statUptime = document.getElementById('stat-uptime');
  const statRequests = document.getElementById('stat-requests');
  const statSuccessRate = document.getElementById('stat-success-rate');
  const statAvailableKeys = document.getElementById('stat-available-keys');
  
  if (statUptime) statUptime.textContent = status.uptimeFormatted || '--';
  if (statRequests) statRequests.textContent = status.stats?.totalRequests || 0;
  if (statSuccessRate) {
    const rate = status.stats?.successRate ?? 100;
    statSuccessRate.textContent = `${rate}%`;
    statSuccessRate.className = `stat-value ${rate >= 90 ? 'good' : rate >= 70 ? 'warning' : 'bad'}`;
  }
  if (statAvailableKeys) statAvailableKeys.textContent = `${status.available}/${status.total}`;
}

// 更新健康度指示
function updateHealthIndicator(status) {
  const indicator = document.getElementById('health-indicator');
  if (!indicator) return;
  
  const icon = indicator.querySelector('.health-icon');
  const text = indicator.querySelector('.health-text');
  
  if (status.healthLevel === 'healthy') {
    icon.textContent = '🟢';
    text.textContent = '服务健康';
    indicator.className = 'health-indicator healthy';
  } else if (status.healthLevel === 'warning') {
    icon.textContent = '🟡';
    text.textContent = '部分 Key 冷却中';
    indicator.className = 'health-indicator warning';
  } else {
    icon.textContent = '🔴';
    text.textContent = '服务不可用';
    indicator.className = 'health-indicator critical';
  }
}

// 更新下次恢复时间
function updateNextRecovery(status) {
  const recoveryDiv = document.getElementById('next-recovery');
  const countdown = document.getElementById('recovery-countdown');
  
  if (!recoveryDiv || !countdown) return;
  
  if (status.nextRecoveryTime && status.nextRecoveryTime > 0) {
    recoveryDiv.classList.remove('hidden');
    countdown.textContent = status.nextRecoveryFormatted || '--';
  } else {
    recoveryDiv.classList.add('hidden');
  }
}

// 用运行时状态更新 Key 列表
function updateKeysWithStatus(keysStatus) {
  const keyItems = allGeminiKeysList?.querySelectorAll('.key-item');
  if (!keyItems || !keysStatus) return;
  
  keysStatus.forEach((keyStatus, index) => {
    const keyItem = keyItems[index];
    if (!keyItem) return;
    
    // 更新状态标签
    let statusEl = keyItem.querySelector('.key-status');
    if (statusEl) {
      statusEl.className = `key-status ${keyStatus.status}`;
      statusEl.innerHTML = `${keyStatus.statusEmoji} ${keyStatus.statusText}`;
    }
    
    // 更新配额信息（RPM）
    let quotaEl = keyItem.querySelector('.key-quota');
    if (!quotaEl) {
      quotaEl = document.createElement('span');
      quotaEl.className = 'key-quota';
      keyItem.querySelector('.key-info')?.appendChild(quotaEl);
    }
    if (keyStatus.rpm) {
      const rpmPercent = parseInt(keyStatus.rpm.percentage);
      const rpmClass = rpmPercent >= 80 ? 'danger' : rpmPercent >= 50 ? 'warning' : '';
      quotaEl.innerHTML = `<span class="${rpmClass}" title="每分钟请求 (${keyStatus.rpm.remaining} 剩余)">⚡ ${keyStatus.rpm.current}/${keyStatus.rpm.limit}</span>`;
    }
    
    // 更新每日配额
    let dailyEl = keyItem.querySelector('.key-daily');
    if (!dailyEl) {
      dailyEl = document.createElement('span');
      dailyEl.className = 'key-daily';
      keyItem.querySelector('.key-info')?.appendChild(dailyEl);
    }
    if (keyStatus.daily) {
      const dailyPercent = parseFloat(keyStatus.daily.percentage);
      const dailyClass = dailyPercent >= 90 ? 'danger' : dailyPercent >= 70 ? 'warning' : '';
      dailyEl.innerHTML = `<span class="${dailyClass}" title="今日已用 ${keyStatus.daily.used}，重置时间: ${keyStatus.daily.resetIn}">📊 ${keyStatus.daily.remaining}</span>`;
    }
    
    // 更新统计信息
    let statsEl = keyItem.querySelector('.key-stats');
    if (!statsEl) {
      statsEl = document.createElement('div');
      statsEl.className = 'key-stats';
      keyItem.querySelector('.key-info')?.appendChild(statsEl);
    }
    
    // 成功率显示
    const successRate = parseFloat(keyStatus.successRate || 100);
    const rateClass = successRate >= 90 ? 'good' : successRate >= 70 ? 'warning' : 'bad';
    
    statsEl.innerHTML = `
      <span class="stat-mini" title="总请求/成功/失败">📈 ${keyStatus.totalRequests || 0}/${keyStatus.totalSuccesses || 0}/${keyStatus.totalFailures || 0}</span>
      <span class="stat-mini ${rateClass}" title="成功率">${successRate}%</span>
    `;
    
    // 如果有错误，显示错误信息
    if (keyStatus.lastError) {
      let errorEl = keyItem.querySelector('.key-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'key-error';
        keyItem.appendChild(errorEl);
      }
      errorEl.innerHTML = `<span title="${keyStatus.lastError}">⚠️ ${keyStatus.lastError.slice(0, 30)}...</span>`;
    }
    
    // 如果在冷却中，显示倒计时
    if (keyStatus.status === 'cooldown' && keyStatus.cooldownRemaining) {
      let cooldownEl = keyItem.querySelector('.key-cooldown');
      if (!cooldownEl) {
        cooldownEl = document.createElement('div');
        cooldownEl.className = 'key-cooldown';
        keyItem.appendChild(cooldownEl);
      }
      cooldownEl.innerHTML = `<span class="countdown">⏳ ${keyStatus.cooldownRemaining}</span>`;
    } else {
      keyItem.querySelector('.key-cooldown')?.remove();
    }
  });
}

// 启动状态自动刷新
function startProxyStatusRefresh() {
  stopProxyStatusRefresh();
  proxyStatusTimer = setInterval(updateProxyStatus, 3000); // 每3秒刷新
}

// 停止状态自动刷新
function stopProxyStatusRefresh() {
  if (proxyStatusTimer) {
    clearInterval(proxyStatusTimer);
    proxyStatusTimer = null;
  }
}

// 渲染所有 Gemini Keys（增强版，显示详细状态）
function renderAllGeminiKeys() {
  if (!allGeminiKeysList) return;
  
  if (allGeminiKeys.length === 0) {
    allGeminiKeysList.innerHTML = `
      <div class="keys-empty">
        <span class="empty-icon">🔑</span>
        <p>还没有可用的 Gemini Key</p>
        <p class="empty-hint">请先在「API 配置」中添加 Gemini 配置，或在下方手动添加 Key</p>
      </div>
    `;
    return;
  }
  
  allGeminiKeysList.innerHTML = '';
  
  allGeminiKeys.forEach((keyObj, index) => {
    const item = document.createElement('div');
    item.className = 'key-item';
    item.dataset.keyIndex = index;
    
    const keyPreview = keyObj.key ? `${keyObj.key.slice(0, 8)}...${keyObj.key.slice(-4)}` : 'N/A';
    const sourceText = keyObj.source === 'api-config' 
      ? `📌 ${keyObj.configName || 'API配置'}` 
      : '✋ 手动添加';
    
    item.innerHTML = `
      <div class="key-main">
        <span class="key-index">#${index + 1}</span>
        <span class="key-preview">${keyPreview}</span>
        <span class="key-source">${sourceText}</span>
      </div>
      <div class="key-info">
        <span class="key-status active">🟢 就绪</span>
        <div class="key-stats"></div>
      </div>
      <div class="key-actions-inline">
        <button class="key-action-btn test-key-btn" data-index="${index}" title="测试此 Key">🔍</button>
        <button class="key-action-btn reset-key-btn" data-index="${index}" title="重置此 Key">🔄</button>
      </div>
    `;
    
    allGeminiKeysList.appendChild(item);
  });
}

// 渲染手动添加的 Keys
function renderManualGeminiKeys() {
  if (!manualGeminiKeysList) return;
  
  const manualKeys = proxyConfig.geminiKeys || [];
  
  if (manualKeys.length === 0) {
    manualGeminiKeysList.innerHTML = '';
    return;
  }
  
  manualGeminiKeysList.innerHTML = '';
  
  manualKeys.forEach((keyObj, index) => {
    const item = document.createElement('div');
    item.className = `key-item ${!keyObj.enabled ? 'disabled' : ''}`;
    
    const keyPreview = keyObj.key ? `${keyObj.key.slice(0, 8)}...${keyObj.key.slice(-4)}` : 'N/A';
    
    item.innerHTML = `
      <span class="key-index">+${index + 1}</span>
      <span class="key-preview">${keyPreview}</span>
      <span class="key-status ${keyObj.enabled ? 'active' : 'disabled'}">${keyObj.enabled ? '启用' : '禁用'}</span>
      <div class="key-actions">
        <button class="icon-btn toggle-key-btn" data-id="${keyObj.id}" data-enabled="${keyObj.enabled}" title="${keyObj.enabled ? '禁用' : '启用'}">
          ${keyObj.enabled ? '⏸️' : '▶️'}
        </button>
        <button class="icon-btn delete-key-btn" data-id="${keyObj.id}" title="删除">🗑️</button>
      </div>
    `;
    
    manualGeminiKeysList.appendChild(item);
  });
}

// 绑定中转站事件
function bindProxyEvents() {
  // 启用/禁用中转站
  proxyEnabledCheckbox?.addEventListener('change', async () => {
    if (proxyEnabledCheckbox.checked) {
      // 启动中转站
      const result = await window.electronAPI.startProxyServer();
      if (result.success) {
        showToast(`🚀 中转站已启动！${result.keyCount} 个 Key 可用`, 'success');
        startProxyStatusRefresh(); // 开始自动刷新
      } else {
        showToast(`❌ 启动失败：${result.error}`, 'error');
        proxyEnabledCheckbox.checked = false;
      }
    } else {
      // 停止中转站
      const result = await window.electronAPI.stopProxyServer();
      if (result.success) {
        showToast('⏹️ 中转站已停止', 'info');
        stopProxyStatusRefresh(); // 停止自动刷新
      }
    }
    await updateProxyStatus();
  });
  
  // 测试连接按钮
  document.getElementById('test-connection-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('test-connection-btn');
    btn.disabled = true;
    btn.textContent = '⏳ 测试中...';
    
    try {
      const result = await window.electronAPI.testProxyConnection();
      if (result.success) {
        showToast(`✅ ${result.message}`, 'success');
      } else {
        showToast(`❌ 连接失败：${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`❌ 测试失败：${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 测试';
    }
    
    await updateProxyStatus();
  });
  
  // 刷新状态按钮
  document.getElementById('refresh-status-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-status-btn');
    btn.classList.add('spinning');
    await updateProxyStatus();
    setTimeout(() => btn.classList.remove('spinning'), 500);
    showToast('🔄 状态已刷新', 'info');
  });
  
  // 重置所有 Key 按钮
  document.getElementById('reset-all-keys-btn')?.addEventListener('click', async () => {
    const result = await window.electronAPI.resetAllProxyKeys();
    if (result.success) {
      showToast('🔄 已重置所有冷却中的 Key', 'success');
      await updateProxyStatus();
    }
  });
  
  // Key 列表操作（事件委托）- 测试和重置单个 Key
  allGeminiKeysList?.addEventListener('click', async (e) => {
    const target = e.target;
    
    if (target.classList.contains('test-key-btn')) {
      const keyIndex = parseInt(target.dataset.index);
      target.disabled = true;
      target.textContent = '⏳';
      
      try {
        const result = await window.electronAPI.testProxyKey(keyIndex);
        if (result.success) {
          showToast(`✅ Key #${keyIndex + 1} 连接正常 (${result.responseTime}ms)`, 'success');
        } else {
          showToast(`❌ Key #${keyIndex + 1} 测试失败：${result.error}`, 'error');
        }
      } catch (error) {
        showToast(`❌ 测试失败：${error.message}`, 'error');
      } finally {
        target.disabled = false;
        target.textContent = '🔍';
      }
      
      await updateProxyStatus();
    } else if (target.classList.contains('reset-key-btn')) {
      const keyIndex = parseInt(target.dataset.index);
      const result = await window.electronAPI.resetProxyKey(keyIndex);
      if (result) {
        showToast(`🔄 Key #${keyIndex + 1} 已重置`, 'success');
        await updateProxyStatus();
      }
    }
  });
  
  // 如果中转站已运行，开始自动刷新
  if (proxyConfig.enabled) {
    startProxyStatusRefresh();
  }
  
  // 自动同步 API 配置
  autoSyncConfigsCheckbox?.addEventListener('change', async () => {
    await window.electronAPI.setAutoSyncApiConfigs(autoSyncConfigsCheckbox.checked);
    proxyConfig.autoSyncApiConfigs = autoSyncConfigsCheckbox.checked;
    
    // 重新加载 Keys
    allGeminiKeys = await window.electronAPI.getAllGeminiKeys();
    renderAllGeminiKeys();
    
    showToast(autoSyncConfigsCheckbox.checked 
      ? '✅ 已开启自动同步，API 配置中的 Gemini Key 会自动加入' 
      : '⏹️ 已关闭自动同步', 'success');
  });
  
  // 端口变化
  proxyPortInput?.addEventListener('change', async () => {
    const port = parseInt(proxyPortInput.value);
    if (port >= 1024 && port <= 65535) {
      await window.electronAPI.setProxyPort(port);
      proxyConfig.port = port;
      showToast('✅ 端口已更新，重启中转站后生效', 'success');
      await updateProxyStatus();
    } else {
      showToast('❌ 端口号必须在 1024-65535 之间', 'error');
    }
  });
  
  // 添加 Gemini Key
  addGeminiKeyBtn?.addEventListener('click', async () => {
    const key = geminiKeyInput.value.trim();
    if (!key) {
      showToast('📝 请输入 API Key', 'info');
      return;
    }
    
    if (!key.startsWith('AIza')) {
      showToast('⚠️ Gemini Key 通常以 AIza 开头，请检查', 'info');
    }
    
    const result = await window.electronAPI.addProxyKey(key);
    if (result.success) {
      proxyConfig.geminiKeys.push(result.key);
      geminiKeyInput.value = '';
      
      // 重新加载所有 Keys
      allGeminiKeys = await window.electronAPI.getAllGeminiKeys();
      renderAllGeminiKeys();
      renderManualGeminiKeys();
      
      showToast('✅ Key 已添加！', 'success');
    }
  });
  
  // Key 列表操作（事件委托）- 只对手动添加的 Key
  manualGeminiKeysList?.addEventListener('click', async (e) => {
    const target = e.target;
    const keyId = target.dataset.id;
    
    if (target.classList.contains('toggle-key-btn')) {
      const currentEnabled = target.dataset.enabled === 'true';
      await window.electronAPI.toggleProxyKey(keyId, !currentEnabled);
      
      // 更新本地数据
      const keyObj = proxyConfig.geminiKeys.find(k => k.id === keyId);
      if (keyObj) {
        keyObj.enabled = !currentEnabled;
      }
      
      // 重新加载所有 Keys
      allGeminiKeys = await window.electronAPI.getAllGeminiKeys();
      renderAllGeminiKeys();
      renderManualGeminiKeys();
      
      showToast(`✅ Key 已${!currentEnabled ? '启用' : '禁用'}`, 'success');
    } else if (target.classList.contains('delete-key-btn')) {
      if (!confirm('确定要删除这个 API Key 吗？')) return;
      
      await window.electronAPI.removeProxyKey(keyId);
      
      // 从本地数据中删除
      proxyConfig.geminiKeys = proxyConfig.geminiKeys.filter(k => k.id !== keyId);
      
      // 重新加载所有 Keys
      allGeminiKeys = await window.electronAPI.getAllGeminiKeys();
      renderAllGeminiKeys();
      renderManualGeminiKeys();
      
      showToast('✅ Key 已删除', 'success');
    }
  });
  
  // 复制按钮
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copy;
      const target = document.getElementById(targetId);
      if (target) {
        navigator.clipboard.writeText(target.textContent);
        showToast('📋 已复制到剪贴板！', 'success');
      }
    });
  });
  
}

// 初始化应用
initialize();
