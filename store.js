// 使用 electron-store 管理配置 - 支持多卡片配置
const Store = require('electron-store');
const { createConversationHistoryStore } = require('./conversation-history');

// 简单的UUID生成函数
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const store = new Store({
  // 固定存储名称，防止应用名更改后丢失数据
  name: 'desktop-helper-config',
  defaults: {
    // 宠物配置
    petImagePath: null,
    petCharacter: 'bubu',
    alwaysOnTop: false,
    
    // 主题配置
    darkMode: false,
    themeColor: 'shiba',

    // 助手个性化配置
    assistantNickname: '小秘书',
    userDisplayName: '',
    reminders: [],
    
    // API 配置卡片列表（默认为空，用户自行添加）
    apiConfigs: [],
    
    // 当前激活的配置ID（默认无）
    activeConfigId: null
  }
});

// 辅助方法
store.getActiveConfig = function() {
  const activeId = this.get('activeConfigId');
  const configs = this.get('apiConfigs', []);
  return configs.find(c => c.id === activeId) || configs[0];
};

store.addConfig = function(config) {
  const configs = this.get('apiConfigs', []);
  const newConfig = {
    id: generateId(),
    enabled: true,
    isDefault: false,
    ...config
  };
  configs.push(newConfig);
  this.set('apiConfigs', configs);
  return newConfig;
};

store.updateConfig = function(id, updates) {
  const configs = this.get('apiConfigs', []);
  const index = configs.findIndex(c => c.id === id);
  if (index !== -1) {
    configs[index] = { ...configs[index], ...updates };
    this.set('apiConfigs', configs);
    return configs[index];
  }
  return null;
};

store.deleteConfig = function(id) {
  const configs = this.get('apiConfigs', []);
  const filtered = configs.filter(c => c.id !== id);
  this.set('apiConfigs', filtered);
  
  // 如果删除的是当前激活的配置，切换到第一个
  if (this.get('activeConfigId') === id && filtered.length > 0) {
    this.set('activeConfigId', filtered[0].id);
  }
};

store.setActiveConfig = function(id) {
  const configs = this.get('apiConfigs', []);
  if (configs.find(c => c.id === id)) {
    this.set('activeConfigId', id);
    return true;
  }
  return false;
};

// ========== 提示词模板管理方法 ==========

// 获取用户自定义模板
store.getCustomTemplates = function() {
  return this.get('customTemplates', []);
};

// 添加自定义模板
store.addCustomTemplate = function(template) {
  const templates = this.getCustomTemplates();
  const newTemplate = {
    id: 'custom-' + generateId(),
    isBuiltin: false,
    category: '自定义',
    ...template
  };
  templates.push(newTemplate);
  this.set('customTemplates', templates);
  return newTemplate;
};

// 更新自定义模板
store.updateCustomTemplate = function(id, updates) {
  const templates = this.getCustomTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index !== -1) {
    templates[index] = { ...templates[index], ...updates };
    this.set('customTemplates', templates);
    return templates[index];
  }
  return null;
};

// 删除自定义模板
store.deleteCustomTemplate = function(id) {
  const templates = this.getCustomTemplates();
  const filtered = templates.filter(t => t.id !== id);
  this.set('customTemplates', filtered);
};

// 获取快捷访问模板列表
store.getQuickAccessTemplates = function() {
  return this.get('quickAccessTemplates', null); // null 表示使用默认配置
};

// 设置快捷访问模板列表
store.setQuickAccessTemplates = function(templateIds) {
  this.set('quickAccessTemplates', templateIds);
};

const conversationHistory = createConversationHistoryStore(store);

store.getConversations = function() {
  return conversationHistory.getAll();
};

store.getConversation = function(id) {
  return conversationHistory.get(id);
};

store.saveConversationRecord = function(conversation) {
  return conversationHistory.upsert(conversation);
};

store.renameConversation = function(id, title) {
  return conversationHistory.rename(id, title);
};

store.deleteConversationRecord = function(id) {
  return conversationHistory.delete(id);
};

module.exports = store;
