// 对话管理 - 支持多配置切换、智能视觉分析和消息编辑
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const screenshotBtn = document.getElementById('screenshot-btn');
const settingsBtn = document.getElementById('settings-btn');
const historyToggleBtn = document.getElementById('history-toggle-btn');
const historyCloseBtn = document.getElementById('history-close-btn');
const historySidebar = document.getElementById('history-sidebar');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const newConversationBtn = document.getElementById('new-conversation-btn');
const statusDiv = document.getElementById('status');
const configSelect = document.getElementById('config-select');
const configInfo = document.getElementById('config-info');
const stopBtn = document.getElementById('stop-btn');
const imageAttachmentPreview = document.getElementById('image-attachment-preview');
const imageAttachmentThumbnail = document.getElementById('image-attachment-thumbnail');
const removeImageAttachmentBtn = document.getElementById('remove-image-attachment');

// 编辑模态框相关
const editModal = document.getElementById('edit-modal');
const editInput = document.getElementById('edit-input');
const editConfirmBtn = document.getElementById('edit-confirm');
const editCancelBtn = document.getElementById('edit-cancel');
const editModalClose = document.getElementById('edit-modal-close');

// 模板相关
const templateBar = document.getElementById('template-bar');
const quickTemplates = document.getElementById('quick-templates');

// 友好消息模块已通过 <script> 标签加载为全局变量
// window.FriendlyMessages, window.getFriendlyMessage, window.formatApiError, window.generateVisionSuggestions

// 对话历史
let conversationHistory = [];
let apiMessages = [];
let conversationRecords = [];
let currentConversationId = null;
let currentConversationTitle = '新对话';
let renamingConversationId = null;
let apiConfigs = [];
let appConfig = null;
let pendingImageAttachment = null;
let assistantNickname = '小秘书';
let userDisplayName = '';

// 生成控制
let isGenerating = false;
let stopGeneration = false;
let editingMessageIndex = -1; // 正在编辑的消息索引

// 模板数据
let builtinTemplatesConfig = null;
let allTemplates = [];

// 智能滚动控制 - 用户手动滚动时不自动滚动
let userScrolled = false;
let programmaticScroll = false; // 标记是否是程序触发的滚动

// 初始化
async function initializeApp() {
  appConfig = await window.electronAPI.getConfig();
  await loadConfigs();
  
  // 加载并应用主题
  await loadTheme();
  await loadPersonalizationSettings();
  
  // 监听夜间模式变化
  window.electronAPI.onThemeChanged(applyDarkMode);
  
  // 监听主题色变化
  window.electronAPI.onChatThemeUpdated(applyChatTheme);
  
  // 监听字体大小变化
  window.electronAPI.onChatFontSizeUpdated(applyFontSize);

  // 刷新已打开聊天窗口中的配置选择器
  window.electronAPI.onApiConfigsChanged(loadConfigs);
  
  startNewConversation({ silent: true });
  await loadConversationRecords();

  if (!await window.electronAPI.storeGet('markdownPath')) {
    addMessage('assistant', '使用前请先在设置 -> 通用设置中选择工作目录。设置完成后即可聊天、生成图片和保存文件。', '提示');
    window.electronAPI.openSettings();
  }
  
  // 监听滚动事件
  messagesContainer.addEventListener('scroll', handleScroll);
  messagesContainer.addEventListener('wheel', handleWheel);
  
  // 绑定编辑模态框事件
  bindEditModalEvents();
  
  // 初始化快捷模板
  await initializeTemplates();
  
}

function deriveConversationTitle(question) {
  const normalized = String(question || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '新对话';
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

function buildApiMessagesFromHistory(history) {
  const messages = [];
  history.forEach(item => {
    if (item.question) {
      messages.push({ role: 'user', content: item.question });
    }
    if (item.answer && item.answer !== '[生成图片]') {
      messages.push({ role: 'assistant', content: item.answer });
    }
  });
  return messages;
}

function getCurrentConversationPayload() {
  return {
    id: currentConversationId,
    title: currentConversationTitle,
    messages: conversationHistory,
    apiMessages
  };
}

async function persistCurrentConversation() {
  if (conversationHistory.length === 0) return null;

  const saved = await window.electronAPI.saveConversationRecord(getCurrentConversationPayload());
  currentConversationId = saved.id;
  currentConversationTitle = saved.title;
  await loadConversationRecords();
  return saved;
}

function renderWelcomeMessage() {
  const welcomeMsg = window.getFriendlyMessage('welcome');
  addMessage('assistant', welcomeMsg.text, assistantNickname);
}

function clearConversationView() {
  conversationHistory = [];
  apiMessages = [];
  messagesContainer.innerHTML = '';
  userScrolled = false;
}

function startNewConversation({ silent = false } = {}) {
  if (isGenerating) {
    showStatus('请先停止 AI 生成再切换对话', 'info');
    return;
  }

  currentConversationId = null;
  currentConversationTitle = '新对话';
  clearConversationView();
  renderWelcomeMessage();
  renderConversationRecords();
  userInput.focus();
  if (!silent) {
    showStatus('已开始新对话', 'success');
  }
}

async function loadConversationRecords() {
  conversationRecords = await window.electronAPI.getConversations();
  renderConversationRecords();
}

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function renderConversationRecords() {
  if (!historyList || !historyEmpty) return;

  historyList.innerHTML = '';
  historyEmpty.classList.toggle('hidden', conversationRecords.length > 0);

  conversationRecords.forEach(record => {
    const item = document.createElement('div');
    item.className = `history-item${record.id === currentConversationId ? ' active' : ''}`;
    item.dataset.id = record.id;

    const isRenaming = record.id === renamingConversationId;
    const main = document.createElement(isRenaming ? 'div' : 'button');
    if (!isRenaming) {
      main.type = 'button';
    }
    main.className = 'history-item-main';
    main.title = record.title;
    if (!isRenaming) {
      main.addEventListener('click', () => loadConversation(record.id));
    }

    if (isRenaming) {
      const input = document.createElement('input');
      input.className = 'history-title-input';
      input.value = record.title;
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitRenameConversation(record, input.value);
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          renamingConversationId = null;
          renderConversationRecords();
        }
      });
      input.addEventListener('blur', () => commitRenameConversation(record, input.value));
      main.appendChild(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      const title = document.createElement('span');
      title.className = 'history-item-title';
      title.textContent = record.title;
      main.appendChild(title);
    }

    const meta = document.createElement('span');
    meta.className = 'history-item-meta';
    meta.textContent = formatConversationTime(record.updatedAt);

    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'history-item-actions';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'history-action-btn';
    renameBtn.textContent = '✎';
    renameBtn.title = '重命名';
    renameBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      beginRenameConversation(record);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'history-action-btn danger';
    deleteBtn.textContent = '×';
    deleteBtn.title = '删除';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteConversation(record);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(main);
    item.appendChild(actions);
    historyList.appendChild(item);
  });
}

async function loadConversation(id) {
  if (isGenerating) {
    showStatus('请先停止 AI 生成再切换对话', 'info');
    return;
  }

  const record = await window.electronAPI.getConversation(id);
  if (!record) {
    showStatus('未找到这条对话记录', 'warning');
    await loadConversationRecords();
    return;
  }

  currentConversationId = record.id;
  currentConversationTitle = record.title;
  conversationHistory = Array.isArray(record.messages) ? record.messages : [];
  apiMessages = Array.isArray(record.apiMessages) && record.apiMessages.length > 0
    ? record.apiMessages
    : buildApiMessagesFromHistory(conversationHistory);

  messagesContainer.innerHTML = '';
  renderWelcomeMessage();
  conversationHistory.forEach((item, index) => {
    addMessage('user', item.question, null, null, index);
    addMessage('assistant', item.answer, item.model || null);
  });
  forceScrollToBottom();
  renderConversationRecords();
}

function beginRenameConversation(record) {
  renamingConversationId = record.id;
  renderConversationRecords();
}

async function commitRenameConversation(record, nextTitle) {
  if (renamingConversationId !== record.id) return;

  const title = nextTitle.trim();
  if (!title) {
    showStatus('标题不能为空', 'info');
    return;
  }

  if (title === record.title) {
    renamingConversationId = null;
    renderConversationRecords();
    return;
  }

  const result = await window.electronAPI.renameConversation(record.id, title);
  if (result.success) {
    renamingConversationId = null;
    if (record.id === currentConversationId) {
      currentConversationTitle = result.conversation.title;
    }
    await loadConversationRecords();
    showStatus('已重命名对话', 'success');
  } else {
    renamingConversationId = null;
    showStatus(result.error || '重命名失败', 'warning');
  }
}

async function deleteConversation(record) {
  if (isGenerating) {
    showStatus('请先停止 AI 生成再删除对话', 'info');
    return;
  }

  const confirmed = window.confirm(`删除「${record.title}」？此操作不可恢复。`);
  if (!confirmed) return;

  const result = await window.electronAPI.deleteConversationRecord(record.id);
  if (!result.success) {
    showStatus('删除失败，可能已不存在', 'warning');
    await loadConversationRecords();
    return;
  }

  await loadConversationRecords();
  if (record.id === currentConversationId) {
    const nextRecord = conversationRecords[0];
    if (nextRecord) {
      await loadConversation(nextRecord.id);
    } else {
      startNewConversation({ silent: true });
    }
  } else {
    renderConversationRecords();
  }
  showStatus('已删除对话', 'success');
}

async function loadPersonalizationSettings() {
  assistantNickname = await window.electronAPI.storeGet('assistantNickname') || '小秘书';
  userDisplayName = await window.electronAPI.storeGet('userDisplayName') || '';
}

// 加载主题
async function loadTheme() {
  const darkMode = await window.electronAPI.storeGet('darkMode') || false;
  applyDarkMode(darkMode);
  
  // 加载主题色
  const chatTheme = await window.electronAPI.storeGet('chatTheme') || 'shiba';
  applyChatTheme(chatTheme);
  
  // 加载字体大小
  const fontSize = await window.electronAPI.storeGet('chatFontSize') || 'medium';
  applyFontSize(fontSize);
}

// 应用夜间模式
function applyDarkMode(isDarkMode) {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// 应用主题（兼容旧接口）
function applyTheme(isDarkMode) {
  applyDarkMode(isDarkMode);
}

// 应用主题色
function applyChatTheme(theme) {
  // 移除所有主题类
  document.body.classList.remove('theme-shiba', 'theme-blue', 'theme-purple', 'theme-green');
  // 添加新主题类（shiba 是默认主题，不需要添加类）
  if (theme !== 'shiba') {
    document.body.classList.add(`theme-${theme}`);
  }
}

// 应用字体大小
function applyFontSize(fontSize) {
  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.body.classList.add(`font-${fontSize}`);
}

// 绑定编辑模态框事件
function bindEditModalEvents() {
  editConfirmBtn.addEventListener('click', handleEditConfirm);
  editCancelBtn.addEventListener('click', closeEditModal);
  editModalClose.addEventListener('click', closeEditModal);
  
  // 点击背景关闭
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      closeEditModal();
    }
  });
  
  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
      closeEditModal();
    }
  });
}

// 打开编辑模态框
function openEditModal(messageContent, messageIndex) {
  if (isGenerating) {
    showStatus('请先停止 AI 生成再编辑消息', 'info');
    return;
  }
  
  editingMessageIndex = messageIndex;
  editInput.value = messageContent;
  editModal.classList.remove('hidden');
  editInput.focus();
  editInput.select();
}

// 关闭编辑模态框
function closeEditModal() {
  editModal.classList.add('hidden');
  editingMessageIndex = -1;
  editInput.value = '';
}

// 处理编辑确认
async function handleEditConfirm() {
  const newContent = editInput.value.trim();
  if (!newContent) {
    showStatus('消息不能为空哦~', 'info');
    return;
  }
  
  closeEditModal();
  
  // 删除从编辑点开始的所有消息
  removeMessagesFromIndex(editingMessageIndex);
  
  // 重新发送编辑后的消息
  userInput.value = newContent;
  await sendMessage(false);
}

// 从指定索引开始删除消息
function removeMessagesFromIndex(userMessageIndex) {
  // 找出需要删除的消息数量
  // userMessageIndex 对应 conversationHistory 的索引
  // 需要删除从这条用户消息开始的所有内容
  
  // 计算要删除的对话轮数
  const turnsToRemove = conversationHistory.length - userMessageIndex;
  
  // 删除 conversationHistory
  conversationHistory = conversationHistory.slice(0, userMessageIndex);
  
  // 删除 apiMessages（每轮有 user 和 assistant 两条）
  const messagesToRemove = turnsToRemove * 2;
  // 保留到 userMessageIndex 对应的位置
  apiMessages = apiMessages.slice(0, userMessageIndex * 2);
  
  // 删除 DOM 中的消息
  const allMessages = messagesContainer.querySelectorAll('.message');
  let userMsgCount = 0;
  let startRemoving = false;
  
  Array.from(allMessages).forEach(msg => {
    if (msg.classList.contains('user')) {
      if (userMsgCount === userMessageIndex) {
        startRemoving = true;
      }
      if (startRemoving) {
        msg.remove();
      } else {
        userMsgCount++;
      }
    } else if (startRemoving) {
      msg.remove();
    }
  });
}

// 处理滚动事件 - 检测用户是否手动滚动
function handleScroll() {
  // 如果是程序触发的滚动，忽略
  if (programmaticScroll) {
    return;
  }
  
  // 用户手动滚动，检查是否远离底部
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  
  // 如果距离底部超过 150px，认为用户在查看历史消息
  if (distanceFromBottom > 150) {
    userScrolled = true;
  } else {
    // 如果用户滚动到接近底部，恢复自动滚动
    userScrolled = false;
  }
}

// 监听鼠标滚轮事件 - 更准确地检测用户滚动意图
function handleWheel(e) {
  // 向上滚动（查看历史）
  if (e.deltaY < 0) {
    userScrolled = true;
  } else {
    // 向下滚动，检查是否接近底部
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom < 50) {
      userScrolled = false;
    }
  }
}

// 智能滚动到底部
function smartScrollToBottom() {
  if (!userScrolled) {
    programmaticScroll = true;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    // 短暂延迟后重置标志，确保 scroll 事件处理完成
    requestAnimationFrame(() => {
      programmaticScroll = false;
    });
  }
}

// 强制滚动到底部
function forceScrollToBottom() {
  userScrolled = false;
  programmaticScroll = true;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  requestAnimationFrame(() => {
    programmaticScroll = false;
  });
}

// 加载配置列表
async function loadConfigs() {
  apiConfigs = await window.electronAPI.getApiConfigs();
  const activeConfig = await window.electronAPI.getActiveConfig();
  
  configSelect.innerHTML = '';
  
  const enabledConfigs = apiConfigs.filter(c => c.enabled);
  
  if (enabledConfigs.length === 0) {
    configSelect.innerHTML = '<option value="">还没有配置呢~</option>';
    configInfo.textContent = '等待配置 🔧';
    configInfo.className = 'config-badge';
    updateScreenshotButton(false);
    return;
  }
  
  enabledConfigs.forEach(config => {
    const option = document.createElement('option');
    option.value = config.id;
    option.textContent = config.name;
    if (config.id === activeConfig?.id) {
      option.selected = true;
    }
    configSelect.appendChild(option);
  });
  
  await updateConfigInfo();
}

// 检查当前配置是否支持视觉
function checkCurrentVisionSupport() {
  const selectedId = configSelect.value;
  const config = apiConfigs.find(c => c.id === selectedId);
  
  if (!config || !appConfig) return false;
  if (config.provider === 'custom') return true;
  
  const template = appConfig.providerTemplates[config.provider];
  const model = template?.models.find(m => m.id === config.selectedModel);
  
  return model?.supportsVision === true;
}

// 更新截图按钮状态
function updateScreenshotButton(supportsVision) {
  if (supportsVision) {
    screenshotBtn.disabled = false;
    screenshotBtn.title = '截图分析';
    screenshotBtn.style.opacity = '1';
  } else {
    screenshotBtn.disabled = false;
    screenshotBtn.title = '截图分析（当前模型不支持）';
    screenshotBtn.style.opacity = '0.6';
  }
}

// 更新配置信息显示
async function updateConfigInfo() {
  const selectedId = configSelect.value;
  const config = apiConfigs.find(c => c.id === selectedId);
  
  if (!config) {
    configInfo.textContent = '等待配置 🔧';
    configInfo.className = 'config-badge';
    updateScreenshotButton(false);
    return;
  }
  
  const template = appConfig.providerTemplates[config.provider];
  const model = template?.models.find(m => m.id === config.selectedModel);
  
  let infoText = `${template?.icon || ''} ${model?.name || config.selectedModel}`;
  const supportsVision = checkCurrentVisionSupport();
  if (supportsVision) {
    infoText += ' 👁️';
  }
  
  configInfo.textContent = infoText;
  configInfo.className = config.apiKey ? 'config-badge success' : 'config-badge';
  
  updateScreenshotButton(supportsVision);
}

function setImageAttachment(attachment) {
  pendingImageAttachment = attachment;
  imageAttachmentThumbnail.src = `data:${attachment.mimeType};base64,${attachment.base64}`;
  imageAttachmentPreview.classList.remove('hidden');
}

function clearImageAttachment() {
  pendingImageAttachment = null;
  imageAttachmentThumbnail.removeAttribute('src');
  imageAttachmentPreview.classList.add('hidden');
}

function insertTextAtCursor(text) {
  const start = userInput.selectionStart ?? userInput.value.length;
  const end = userInput.selectionEnd ?? userInput.value.length;
  userInput.value = `${userInput.value.slice(0, start)}${text}${userInput.value.slice(end)}`;
  const cursor = start + text.length;
  userInput.setSelectionRange(cursor, cursor);
  autoResizeTextarea();
  userInput.focus();
}

function handleExternalPaste(payload) {
  if (!payload) return;

  if (payload.type === 'image' && payload.base64) {
    setImageAttachment({
      base64: payload.base64,
      mimeType: payload.mimeType || 'image/png'
    });
    showStatus('已从剪贴板粘贴图片，输入问题后发送即可', 'success');
    userInput.focus();
    return;
  }

  if (payload.type === 'text' && payload.text) {
    insertTextAtCursor(payload.text);
    showStatus('已从剪贴板粘贴到输入框', 'success');
  }
}

function getImageSource(image) {
  if (typeof image === 'string') {
    return `data:image/png;base64,${image}`;
  }

  return image.url || `data:${image.mimeType || 'image/png'};base64,${image.base64}`;
}

function buildPersonalizedMessages(messages) {
  const nickname = assistantNickname || '小秘书';
  const userName = userDisplayName || '你';
  const personalizationPrompt = `你在本应用中的助手昵称是「${nickname}」。请用中文回复。称呼用户时，使用「${userName}」。`;

  if (messages.length > 0 && messages[0].role === 'system') {
    return [
      { ...messages[0], content: `${personalizationPrompt}\n\n${messages[0].content}` },
      ...messages.slice(1)
    ];
  }

  return [
    { role: 'system', content: personalizationPrompt },
    ...messages
  ];
}

function buildPersonalizedPrompt(prompt) {
  const nickname = assistantNickname || '小秘书';
  const userName = userDisplayName || '你';
  return `你在本应用中的助手昵称是「${nickname}」。请用中文回复。称呼用户时，使用「${userName}」。\n\n${prompt}`;
}

function handleImagePaste(event) {
  const imageItem = window.ImageAttachment.findClipboardImage(event.clipboardData?.items);
  if (!imageItem) return;

  event.preventDefault();
  const imageFile = imageItem.getAsFile();
  if (!imageFile) return;

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const attachment = window.ImageAttachment.parseImageDataUrl(reader.result);
    if (!attachment) return;

    setImageAttachment(attachment);
    showStatus('已粘贴图片，输入问题后发送即可', 'success');
  });
  reader.readAsDataURL(imageFile);
}

// 添加消息到界面
function addMessage(role, content, model = null, screenshot = null, messageIndex = -1) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  if (role === 'user') {
    // 为用户消息添加点击编辑功能
    const actualIndex = messageIndex >= 0 ? messageIndex : conversationHistory.length;
    messageDiv.dataset.messageIndex = actualIndex;
    messageDiv.addEventListener('click', () => {
      openEditModal(content, actualIndex);
    });
  } else {
    const label = document.createElement('div');
    label.className = 'message-label';
    label.innerHTML = `${assistantNickname || '小秘书'}${model ? ` <span class="model-badge">${model}</span>` : ''}`;
    messageDiv.appendChild(label);
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  messageDiv.appendChild(contentDiv);
  
  if (screenshot) {
    const img = document.createElement('img');
    img.src = getImageSource(screenshot);
    img.className = 'screenshot-preview';
    messageDiv.appendChild(img);
  }
  
  messagesContainer.appendChild(messageDiv);
  smartScrollToBottom();
  
  return messageDiv;
}

// 流式添加消息（支持停止）
async function addMessageStreaming(role, content, model = null, screenshot = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content streaming';
  
  if (role !== 'user') {
    const label = document.createElement('div');
    label.className = 'message-label';
    label.innerHTML = `${assistantNickname || '小秘书'}${model ? ` <span class="model-badge">${model}</span>` : ''}`;
    messageDiv.appendChild(label);
  }
  messageDiv.appendChild(contentDiv);
  
  if (screenshot) {
    const img = document.createElement('img');
    img.src = getImageSource(screenshot);
    img.className = 'screenshot-preview';
    messageDiv.appendChild(img);
  }
  
  messagesContainer.appendChild(messageDiv);
  
  // 流式显示
  let currentText = '';
  const chars = content.split('');
  const delay = 12;
  
  for (const char of chars) {
    if (stopGeneration) {
      currentText += '...(已停止)';
      contentDiv.textContent = currentText;
      break;
    }
    
    currentText += char;
    contentDiv.textContent = currentText;
    smartScrollToBottom();
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  contentDiv.classList.remove('streaming');
  
  return { messageDiv, displayedContent: currentText };
}

// 显示/隐藏加载动画
function showLoading() {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading';
  loadingDiv.id = 'loading-indicator';
  loadingDiv.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(loadingDiv);
  smartScrollToBottom();
}

function hideLoading() {
  const loadingDiv = document.getElementById('loading-indicator');
  if (loadingDiv) loadingDiv.remove();
}

// 显示状态提示
function showStatus(message, type = 'success') {
  statusDiv.textContent = message;
  statusDiv.className = type;
  setTimeout(() => statusDiv.classList.add('hidden'), 3000);
}

async function ensureWorkDirectorySelected() {
  const workDirectory = await window.electronAPI.storeGet('markdownPath');
  if (workDirectory) {
    return true;
  }

  showStatus('请先到设置 -> 通用设置选择工作目录，再开始使用。', 'warning');
  window.electronAPI.openSettings();
  return false;
}

// 发送消息
async function sendMessage(isRegenerate = false) {
  if (!await ensureWorkDirectorySelected()) return;

  const question = userInput.value.trim();

  if (pendingImageAttachment) {
    await sendImageMessage(question || '请分析这张图片');
    return;
  }

  if (window.ImageIntent.requestsImageOutput(question)) {
    await sendGeneratedImage(question);
    return;
  }
  
  if (!question) {
    const msg = window.getFriendlyMessage('noInput');
    showStatus(msg.text, msg.type);
    return;
  }
  
  const selectedId = configSelect.value;
  if (!selectedId) {
    const msg = window.getFriendlyMessage('noConfig');
    showStatus(msg.text, msg.type);
    return;
  }
  
  // 设置为激活配置
  await window.electronAPI.setActiveConfig(selectedId);
  
  // 开始生成
  isGenerating = true;
  stopGeneration = false;
  
  // 更新按钮状态
  updateButtonStates(true);
  
  // 添加用户消息并记录索引
  const userMsgIndex = conversationHistory.length;
  addMessage('user', question, null, null, userMsgIndex);
  forceScrollToBottom();
  
  userInput.value = '';
  userInput.style.height = 'auto';
  
  // 更新 apiMessages
  apiMessages.push({
    role: 'user',
    content: question
  });
  
  showLoading();
  
  try {
    await loadPersonalizationSettings();
    const requestMessages = buildPersonalizedMessages(apiMessages);
    const response = await window.electronAPI.sendMessage(requestMessages);
    
    hideLoading();
    
    if (response.success) {
      const answer = response.content;
      const model = response.model;
      
      const result = await addMessageStreaming('assistant', answer, model);
      const displayedAnswer = result.displayedContent || answer;
      
      apiMessages.push({
        role: 'assistant',
        content: displayedAnswer
      });
      
      conversationHistory.push({
        question: question,
        answer: displayedAnswer,
        model: model,
        toolCalls: response.toolCalls
      });
      if (!currentConversationId && conversationHistory.length === 1) {
        currentConversationTitle = deriveConversationTitle(question);
      }
      await persistCurrentConversation();
    } else {
      const friendlyError = window.formatApiError(response.error || '未知错误');
      const msg = window.getFriendlyMessage('apiCallFailed', friendlyError);
      addMessage('assistant', msg.text, '提示 💡');
      showStatus(msg.text.split('\n')[0], msg.type);
    }
  } catch (error) {
    hideLoading();
    console.error('发送消息失败:', error);
    const friendlyError = window.formatApiError(error.message);
    const msg = window.getFriendlyMessage('apiCallFailed', friendlyError);
    addMessage('assistant', msg.text, '提示 💡');
    showStatus(msg.text.split('\n')[0], msg.type);
  } finally {
    isGenerating = false;
    stopGeneration = false;
    updateButtonStates(false);
    userInput.focus();
  }
}

async function sendImageMessage(question) {
  if (!await ensureWorkDirectorySelected()) return;

  const selectedId = configSelect.value;
  if (!selectedId) {
    const msg = window.getFriendlyMessage('noConfig');
    showStatus(msg.text, msg.type);
    return;
  }

  const attachment = pendingImageAttachment;
  if (!attachment) return;

  await window.electronAPI.setActiveConfig(selectedId);
  isGenerating = true;
  stopGeneration = false;
  updateButtonStates(true);

  const userMsgIndex = conversationHistory.length;
  addMessage('user', question, null, attachment, userMsgIndex);
  clearImageAttachment();
  userInput.value = '';
  userInput.style.height = 'auto';
  showLoading();

  try {
    await loadPersonalizationSettings();
    const imageEditRequested = window.ImageIntent.requestsImageOutput(question);
    showStatus(imageEditRequested ? '正在根据原图生成新图片...' : '正在分析你粘贴的图片...', 'info');
    const result = imageEditRequested
      ? await window.electronAPI.generateImage(question, attachment.base64, attachment.mimeType)
      : await window.electronAPI.analyzeImage(attachment.base64, buildPersonalizedPrompt(question), attachment.mimeType);
    hideLoading();

    if (result.success) {
      if (imageEditRequested) {
        addGeneratedImageMessage(result.image, result.model);
      } else {
        await addMessageStreaming('assistant', result.content, result.model);
      }
      conversationHistory.push({
        question,
        answer: imageEditRequested ? '[生成图片]' : result.content,
        model: result.model
      });
      if (!currentConversationId && conversationHistory.length === 1) {
        currentConversationTitle = deriveConversationTitle(question);
      }
      await persistCurrentConversation();
      showStatus(imageEditRequested ? '图片已生成' : '图片分析完成', 'success');
    } else {
      const friendlyError = window.formatApiError(result.error || '未知错误');
      const msg = window.getFriendlyMessage('apiCallFailed', friendlyError);
      addMessage('assistant', msg.text, '提示 💡');
      showStatus(msg.text.split('\n')[0], msg.type);
    }
  } catch (error) {
    hideLoading();
    const friendlyError = window.formatApiError(error.message);
    const msg = window.getFriendlyMessage('apiCallFailed', friendlyError);
    addMessage('assistant', msg.text, '提示 💡');
    showStatus(msg.text.split('\n')[0], msg.type);
  } finally {
    isGenerating = false;
    stopGeneration = false;
    updateButtonStates(false);
    userInput.focus();
  }
}

async function sendGeneratedImage(prompt) {
  if (!await ensureWorkDirectorySelected()) return;

  const selectedId = configSelect.value;
  if (!selectedId) {
    const msg = window.getFriendlyMessage('noConfig');
    showStatus(msg.text, msg.type);
    return;
  }

  await window.electronAPI.setActiveConfig(selectedId);
  isGenerating = true;
  updateButtonStates(true);
  const userMsgIndex = conversationHistory.length;
  addMessage('user', prompt, null, null, userMsgIndex);
  userInput.value = '';
  userInput.style.height = 'auto';
  showLoading();
  showStatus('正在通过 gpt-image-2 生成图片，排队时可能需要几分钟...', 'info');

  try {
    const result = await window.electronAPI.generateImage(prompt);
    hideLoading();
    if (result.success) {
      addGeneratedImageMessage(result.image, result.model);
      conversationHistory.push({
        question: prompt,
        answer: '[生成图片]',
        model: result.model
      });
      if (!currentConversationId && conversationHistory.length === 1) {
        currentConversationTitle = deriveConversationTitle(prompt);
      }
      await persistCurrentConversation();
      showStatus('图片已生成', 'success');
    } else {
      const friendlyError = window.formatApiError(result.error || '未知错误');
      const msg = window.getFriendlyMessage('apiCallFailed', friendlyError);
      addMessage('assistant', msg.text, '提示 💡');
      showStatus(msg.text.split('\n')[0], msg.type);
    }
  } catch (error) {
    hideLoading();
    const friendlyError = window.formatApiError(error.message);
    const msg = window.getFriendlyMessage('apiCallFailed', friendlyError);
    addMessage('assistant', msg.text, '提示 💡');
    showStatus(msg.text.split('\n')[0], msg.type);
  } finally {
    isGenerating = false;
    updateButtonStates(false);
    userInput.focus();
  }
}

function addGeneratedImageMessage(image, model) {
  const messageDiv = addMessage('assistant', '图片生成完成', model);
  const img = document.createElement('img');
  img.src = getImageSource(image);
  img.className = 'generated-image-preview';
  img.alt = 'AI 生成图片';
  messageDiv.appendChild(img);

  const actions = document.createElement('div');
  actions.className = 'generated-image-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '复制图片';
  copyBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.copyGeneratedImage(image);
    showStatus(result.success ? '图片已复制到剪贴板' : `复制失败：${result.error}`, result.success ? 'success' : 'warning');
  });

  const saveImageBtn = document.createElement('button');
  saveImageBtn.type = 'button';
  saveImageBtn.textContent = '保存图片';
  saveImageBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.saveGeneratedImage(image);
    if (result.success) {
      showStatus('图片已保存', 'success');
    } else if (!result.canceled) {
      showStatus(`保存失败：${result.error}`, 'warning');
    }
  });

  actions.appendChild(copyBtn);
  actions.appendChild(saveImageBtn);
  messageDiv.appendChild(actions);
}

// 停止生成
function handleStopGeneration() {
  stopGeneration = true;
  showStatus('已请求停止生成...', 'info');
}

// 更新按钮状态
function updateButtonStates(generating) {
  userInput.disabled = generating;
  sendBtn.disabled = generating;
  screenshotBtn.disabled = generating;
  
  if (generating) {
    stopBtn.classList.remove('hidden');
    sendBtn.classList.add('hidden');
  } else {
    stopBtn.classList.add('hidden');
    sendBtn.classList.remove('hidden');
  }
}

// 选择截图范围并放入输入区，等待用户补充描述后发送
async function attachScreenshot() {
  if (!await ensureWorkDirectorySelected()) return;

  const selectedId = configSelect.value;
  if (!selectedId) {
    const msg = window.getFriendlyMessage('noConfig');
    showStatus(msg.text, msg.type);
    return;
  }
  
  const supportsVision = checkCurrentVisionSupport();
  const currentConfig = apiConfigs.find(c => c.id === selectedId);
  
  if (!supportsVision) {
    const template = appConfig.providerTemplates[currentConfig.provider];
    const currentModel = template?.models.find(m => m.id === currentConfig.selectedModel);
    const visionModels = template?.models.filter(m => m.supportsVision);
    
    const allVisionConfigs = apiConfigs.filter(c => {
      const t = appConfig.providerTemplates[c.provider];
      const m = t?.models.find(model => model.id === c.selectedModel);
      return m?.supportsVision === true;
    }).map(cfg => {
      const t = appConfig.providerTemplates[cfg.provider];
      const m = t?.models.find(model => model.id === cfg.selectedModel);
      return { name: cfg.name, model: m?.name };
    });
    
    const suggestions = window.generateVisionSuggestions(visionModels, allVisionConfigs);
    const msg = window.getFriendlyMessage('noVisionSupport', currentModel?.name || currentConfig.selectedModel, suggestions);
    
    addMessage('assistant', msg.text, '柴柴助手 🐕');
    showStatus(msg.text.split('\n')[0], msg.type);
    return;
  }
  
  screenshotBtn.disabled = true;
  const capturingMsg = window.getFriendlyMessage('screenshotCapturing');
  showStatus(capturingMsg.text, capturingMsg.type);
  
  try {
    const captureResult = await window.electronAPI.selectScreenshotRegion();
    if (captureResult.canceled) {
      showStatus('已取消截图', 'info');
      return;
    }
    
    if (!captureResult.success) {
      const msg = window.getFriendlyMessage('screenshotFailed', captureResult.error);
      showStatus(msg.text.split('\n')[0], msg.type);
      return;
    }
    
    setImageAttachment({
      base64: captureResult.data,
      mimeType: captureResult.mimeType || 'image/png'
    });
    showStatus('截图已放入输入区，可补充描述后发送', 'success');
    userInput.focus();
  } catch (error) {
    console.error('截图失败:', error);
    const friendlyError = window.formatApiError(error.message);
    const msg = window.getFriendlyMessage('screenshotFailed', friendlyError);
    showStatus(msg.text.split('\n')[0], msg.type);
  } finally {
    screenshotBtn.disabled = false;
  }
}

// 保存对话
async function saveConversation() {
  if (!await ensureWorkDirectorySelected()) return;

  if (conversationHistory.length === 0) {
    const msg = window.getFriendlyMessage('noConversation');
    showStatus(msg.text, msg.type);
    return;
  }
  
  const savingMsg = window.getFriendlyMessage('savingConversation');
  showStatus(savingMsg.text, savingMsg.type);
  
  try {
    const result = await window.electronAPI.saveConversation(conversationHistory);
    
    if (result.success) {
      const msg = window.getFriendlyMessage('saveSuccess', result.filename, result.directory);
      showStatus(msg.text, msg.type);
    } else {
      const msg = window.getFriendlyMessage('saveFailed', result.error);
      showStatus(msg.text.split('\n')[0], msg.type);
    }
  } catch (error) {
    console.error('保存对话失败:', error);
    const msg = window.getFriendlyMessage('saveFailed', error.message);
    showStatus(msg.text.split('\n')[0], msg.type);
  }
}

// 事件监听
sendBtn.addEventListener('click', () => sendMessage(false));
stopBtn.addEventListener('click', handleStopGeneration);
screenshotBtn.addEventListener('click', attachScreenshot);
settingsBtn.addEventListener('click', () => window.electronAPI.openSettings());
removeImageAttachmentBtn.addEventListener('click', clearImageAttachment);
historyToggleBtn.addEventListener('click', () => {
  historySidebar.classList.toggle('collapsed');
});
historyCloseBtn.addEventListener('click', () => {
  historySidebar.classList.add('collapsed');
});
newConversationBtn.addEventListener('click', () => startNewConversation());

configSelect.addEventListener('change', async () => {
  await updateConfigInfo();
  const selectedId = configSelect.value;
  if (selectedId) {
    await window.electronAPI.setActiveConfig(selectedId);
    const msg = window.getFriendlyMessage('configActivated');
    showStatus(msg.text, msg.type);
  }
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(false);
  }
});
userInput.addEventListener('paste', handleImagePaste);

// 输入框自动调整高度
function autoResizeTextarea() {
  userInput.style.height = 'auto';
  const minHeight = 24;
  const maxHeight = 150;
  const newHeight = Math.min(Math.max(userInput.scrollHeight, minHeight), maxHeight);
  userInput.style.height = newHeight + 'px';
}

userInput.addEventListener('input', autoResizeTextarea);

// ========== 快捷模板功能 ==========

// 初始化模板
async function initializeTemplates() {
  try {
    // 加载预设模板
    builtinTemplatesConfig = await window.electronAPI.getBuiltinTemplates();
    allTemplates = builtinTemplatesConfig?.templates || [];
    
    // 渲染快捷模板栏
    renderQuickTemplates();
  } catch (error) {
    console.error('初始化模板失败:', error);
  }
}

// 渲染快捷模板栏
function renderQuickTemplates() {
  if (!quickTemplates) return;
  
  quickTemplates.innerHTML = '';
  
  // 获取快捷访问的模板 ID
  const quickAccessIds = builtinTemplatesConfig?.quickAccess || ['summarize', 'translate', 'polish', 'explain'];
  
  // 找到对应的模板并渲染
  quickAccessIds.forEach(id => {
    const template = allTemplates.find(t => t.id === id);
    if (template) {
      const btn = document.createElement('button');
      btn.className = 'template-quick-btn';
      btn.dataset.templateId = template.id;
      btn.innerHTML = `
        <span class="template-icon">${template.icon}</span>
        <span>${template.name}</span>
      `;
      btn.addEventListener('click', () => applyTemplate(template));
      quickTemplates.appendChild(btn);
    }
  });
}

// 应用模板
function applyTemplate(template) {
  const currentText = userInput.value.trim();
  let promptText = template.prompt;
  
  // 替换占位符
  if (promptText.includes('{{text}}')) {
    const replacement = template.id === 'generate-image' ? (currentText || 'xxxxx') : (currentText || '');
    promptText = promptText.replace(/\{\{text\}\}/g, replacement);
  } else if (currentText) {
    // 如果模板没有占位符但输入框有内容，追加到末尾
    promptText = promptText + '\n\n' + currentText;
  }
  
  userInput.value = promptText;
  autoResizeTextarea();
  userInput.focus();
  
  showStatus(`✨ 已应用模板「${template.name}」`, 'success');
}

// 初始化
userInput.focus();
window.electronAPI.onExternalPaste(handleExternalPaste);
window.electronAPI.notifyChatReadyForPaste();
initializeApp();
