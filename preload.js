const { contextBridge, ipcRenderer } = require('electron');

// 将安全的API暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  openChat: () => {
    ipcRenderer.send('open-chat');
  },

  pasteToChat: () => {
    ipcRenderer.send('paste-to-chat');
  },

  focusPetWindow: () => {
    ipcRenderer.send('focus-pet-window');
  },
  
  openSettings: () => {
    ipcRenderer.send('open-settings');
  },
  
  // 退出应用
  quitApp: () => {
    ipcRenderer.send('quit-app');
  },

  restartApp: () => {
    ipcRenderer.send('restart-app');
  },

  dragPetWindow: (position) => {
    ipcRenderer.send('drag-pet-window', position);
  },

  logPetInteraction: (interaction) => {
    ipcRenderer.send('pet-interaction-event', interaction);
  },

  getReminders: async () => {
    return await ipcRenderer.invoke('get-reminders');
  },

  saveReminder: async (reminder) => {
    return await ipcRenderer.invoke('save-reminder', { reminder });
  },

  deleteReminder: async (id) => {
    return await ipcRenderer.invoke('delete-reminder', { id });
  },

  acknowledgeReminder: async (id) => {
    return await ipcRenderer.invoke('acknowledge-reminder', { id });
  },

  onReminderDue: (callback) => {
    ipcRenderer.on('reminder-due', (event, payload) => callback(payload));
  },

  onReminderCleared: (callback) => {
    ipcRenderer.on('reminder-cleared', () => callback());
  },

  onRemindersChanged: (callback) => {
    ipcRenderer.on('reminders-changed', () => callback());
  },
  
  // AI 对话
  sendMessage: async (messages) => {
    return await ipcRenderer.invoke('send-message', { messages });
  },
  
  // 保存对话
  saveConversation: async (conversation) => {
    return await ipcRenderer.invoke('save-conversation', { conversation });
  },
  
  // 屏幕截图分析
  captureScreen: async () => {
    return await ipcRenderer.invoke('capture-screen');
  },

  selectScreenshotRegion: async () => {
    return await ipcRenderer.invoke('select-screenshot-region');
  },

  onScreenshotSelectionData: (callback) => {
    ipcRenderer.on('screenshot-selection-data', (event, data) => callback(data));
  },

  finishScreenshotSelection: (rect) => {
    ipcRenderer.send('screenshot-selection-finished', rect);
  },

  cancelScreenshotSelection: () => {
    ipcRenderer.send('screenshot-selection-cancelled');
  },
  
  analyzeScreenshot: async (base64Image) => {
    return await ipcRenderer.invoke('analyze-screenshot', { base64Image });
  },

  analyzeImage: async (base64Image, prompt, mimeType) => {
    return await ipcRenderer.invoke('analyze-image', { base64Image, prompt, mimeType });
  },

  generateImage: async (prompt, base64Image, mimeType) => {
    return await ipcRenderer.invoke('generate-image', { prompt, base64Image, mimeType });
  },

  copyGeneratedImage: async (image) => {
    return await ipcRenderer.invoke('copy-generated-image', { image });
  },

  saveGeneratedImage: async (image) => {
    return await ipcRenderer.invoke('save-generated-image', { image });
  },
  
  // API 配置管理
  getConfig: async () => {
    return await ipcRenderer.invoke('get-config');
  },
  
  getApiConfigs: async () => {
    return await ipcRenderer.invoke('get-api-configs');
  },
  
  getActiveConfig: async () => {
    return await ipcRenderer.invoke('get-active-config');
  },
  
  addApiConfig: async (config) => {
    return await ipcRenderer.invoke('add-api-config', { config });
  },
  
  updateApiConfig: async (id, updates) => {
    return await ipcRenderer.invoke('update-api-config', { id, updates });
  },
  
  deleteApiConfig: async (id) => {
    return await ipcRenderer.invoke('delete-api-config', { id });
  },
  
  setActiveConfig: async (id) => {
    return await ipcRenderer.invoke('set-active-config', { id });
  },

  onApiConfigsChanged: (callback) => {
    ipcRenderer.on('api-configs-changed', () => callback());
  },
  
  testApiConfig: async (apiConfig) => {
    return await ipcRenderer.invoke('test-api-config', { apiConfig });
  },
  
  // Store 操作
  storeGet: async (key) => {
    return await ipcRenderer.invoke('store-get', key);
  },
  
  storeSet: async (key, value) => {
    return await ipcRenderer.invoke('store-set', key, value);
  },
  
  storeDelete: async (key) => {
    return await ipcRenderer.invoke('store-delete', key);
  },
  
  // ========== 宠物相关 API ==========
  
  // 更新宠物图片
  updatePetImage: (imagePath) => {
    ipcRenderer.send('update-pet-image', imagePath);
  },

  updatePetCharacter: (character) => {
    ipcRenderer.send('update-pet-character', character);
  },
  
  // 更新宠物大小
  updatePetSize: (size) => {
    ipcRenderer.send('update-pet-size', size);
  },
  
  // 监听宠物图片更新
  onPetImageUpdated: (callback) => {
    ipcRenderer.on('pet-image-updated', (event, imagePath) => callback(imagePath));
  },

  onPetCharacterUpdated: (callback) => {
    ipcRenderer.on('pet-character-updated', (event, character) => callback(character));
  },
  
  // 监听宠物大小更新
  onPetSizeUpdated: (callback) => {
    ipcRenderer.on('pet-size-updated', (event, size) => callback(size));
  },
  
  // ========== 文件/目录选择 API ==========
  
  // 选择目录
  selectDirectory: async () => {
    return await ipcRenderer.invoke('select-directory');
  },
  
  // ========== 对话界面设置 API ==========
  
  // 更新聊天主题色
  updateChatTheme: (theme) => {
    ipcRenderer.send('update-chat-theme', theme);
  },
  
  // 更新聊天字体大小
  updateChatFontSize: (fontSize) => {
    ipcRenderer.send('update-chat-font-size', fontSize);
  },
  
  // 监听聊天主题更新
  onChatThemeUpdated: (callback) => {
    ipcRenderer.on('chat-theme-updated', (event, theme) => callback(theme));
  },
  
  // 监听聊天字体大小更新
  onChatFontSizeUpdated: (callback) => {
    ipcRenderer.on('chat-font-size-updated', (event, fontSize) => callback(fontSize));
  },

  onExternalPaste: (callback) => {
    ipcRenderer.on('external-paste', (event, payload) => callback(payload));
  },

  notifyChatReadyForPaste: () => {
    ipcRenderer.send('chat-ready-for-paste');
  },
  
  // ========== 主题相关 API ==========
  
  // 广播主题变化
  broadcastThemeChange: (isDarkMode) => {
    ipcRenderer.send('theme-changed', isDarkMode);
  },
  
  // 监听主题变化
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDarkMode) => callback(isDarkMode));
  },
  
  // 移除主题变化监听
  removeThemeChangedListener: () => {
    ipcRenderer.removeAllListeners('theme-changed');
  },
  
  // ========== 提示词模板相关 API ==========
  
  // 获取预设模板配置
  getBuiltinTemplates: async () => {
    return await ipcRenderer.invoke('get-builtin-templates');
  },
  
  // 获取用户自定义模板
  getCustomTemplates: async () => {
    return await ipcRenderer.invoke('get-custom-templates');
  },
  
  // 添加自定义模板
  addCustomTemplate: async (template) => {
    return await ipcRenderer.invoke('add-custom-template', { template });
  },
  
  // 更新自定义模板
  updateCustomTemplate: async (id, updates) => {
    return await ipcRenderer.invoke('update-custom-template', { id, updates });
  },
  
  // 删除自定义模板
  deleteCustomTemplate: async (id) => {
    return await ipcRenderer.invoke('delete-custom-template', { id });
  },
  
  // 获取快捷访问模板列表
  getQuickAccessTemplates: async () => {
    return await ipcRenderer.invoke('get-quick-access-templates');
  },
  
  // 设置快捷访问模板列表
  setQuickAccessTemplates: async (templateIds) => {
    return await ipcRenderer.invoke('set-quick-access-templates', { templateIds });
  },
  
});
