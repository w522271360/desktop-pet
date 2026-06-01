const fs = require('fs');
const path = require('path');
const os = require('os');
const { createConversationHistoryStore } = require('./conversation-history');

const legacyAppSupportDirectory = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library/Application Support/桌面小助手')
  : path.join(os.homedir(), '.desktop-helper');
const appDataFolderName = '.desktop-pet';
const appDataDirectory = path.join(os.homedir(), appDataFolderName);
const bootstrapPath = path.join(legacyAppSupportDirectory, 'work-directory.json');
const configFileName = 'desktop-helper-config.json';
const conversationRecordsFileName = 'records.json';

const defaults = {
  petImagePath: null,
  petCharacter: 'bubu',
  alwaysOnTop: true,
  darkMode: false,
  themeColor: 'shiba',
  chatTheme: 'shiba',
  assistantNickname: '小秘书',
  userDisplayName: '主人',
  petAppMode: 'personal',
  petNetworkEnabled: false,
  petServerUrl: '',
  petNetworkClientToken: '',
  petNetworkClientId: '',
  petNetworkNickname: '',
  reminders: [],
  apiConfigs: [],
  activeConfigId: null
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`读取 JSON 文件失败，将使用默认值: ${filePath}`, error.message);
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function isValidWorkDirectory(directory) {
  return typeof directory === 'string' && directory.length > 0 && path.isAbsolute(directory);
}

function getBootstrap() {
  return readJsonFile(bootstrapPath, {});
}

function getLegacyWorkDirectory() {
  const directory = getBootstrap().workDirectory;
  return isValidWorkDirectory(directory) ? directory : '';
}

function getLegacyWorkDirectoryConfigPath() {
  const workDirectory = getLegacyWorkDirectory();
  return workDirectory ? path.join(workDirectory, appDataFolderName, configFileName) : '';
}

function findLegacyConfig() {
  const candidates = [
    getLegacyWorkDirectoryConfigPath(),
    path.join(legacyAppSupportDirectory, appDataFolderName, configFileName),
    path.join(os.homedir(), 'Library/Application Support/桌面小助手/desktop-helper-config.json'),
    path.join(os.homedir(), 'Library/Preferences/electron-store-nodejs/desktop-helper-config.json'),
    path.join(__dirname, 'data/desktop-helper-config.json')
  ].filter(Boolean);

  for (const candidate of candidates) {
    const legacy = readJsonFile(candidate, null);
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      return legacy;
    }
  }

  return {};
}

function getDataDirectory() {
  return appDataDirectory;
}

function getConfigPath() {
  const dataDirectory = getDataDirectory();
  return dataDirectory ? path.join(dataDirectory, configFileName) : '';
}

function getConversationsDirectory() {
  const dataDirectory = getDataDirectory();
  return dataDirectory ? path.join(dataDirectory, 'conversations') : '';
}

function getConversationRecordsPath() {
  const conversationsDirectory = getConversationsDirectory();
  return conversationsDirectory ? path.join(conversationsDirectory, conversationRecordsFileName) : '';
}

function readLegacyConfig() {
  const { conversationRecords, markdownPath, ...configOnly } = findLegacyConfig();
  return configOnly;
}

function findLegacyConversationRecords() {
  const legacyWorkDirectory = getLegacyWorkDirectory();
  const candidates = [
    legacyWorkDirectory ? path.join(legacyWorkDirectory, appDataFolderName, 'conversations', conversationRecordsFileName) : '',
    path.join(legacyAppSupportDirectory, appDataFolderName, 'conversations', conversationRecordsFileName)
  ].filter(Boolean);

  for (const candidate of candidates) {
    const records = readJsonFile(candidate, null);
    if (Array.isArray(records)) {
      return records;
    }
  }

  return [];
}

function readConfig() {
  const configPath = getConfigPath();
  return { ...defaults, ...readJsonFile(configPath, {}) };
}

function writeConfig(config) {
  const configPath = getConfigPath();
  writeJsonFile(configPath, { ...defaults, ...config });
}

function initializeWorkDirectoryFiles() {
  const configPath = getConfigPath();
  const recordsPath = getConversationRecordsPath();

  if (!fs.existsSync(configPath)) {
    writeJsonFile(configPath, {
      ...defaults,
      ...readLegacyConfig()
    });
  }

  if (!fs.existsSync(recordsPath)) {
    writeJsonFile(recordsPath, findLegacyConversationRecords());
  }
}

initializeWorkDirectoryFiles();

const store = {
  get path() {
    return getConfigPath();
  },

  get dataDirectory() {
    return getDataDirectory();
  },

  get conversationsDirectory() {
    return getConversationsDirectory();
  },

  get conversationRecordsPath() {
    return getConversationRecordsPath();
  },

  get(key, fallback) {
    const data = readConfig();
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return data[key];
    }
    if (fallback !== undefined) return fallback;
    return defaults[key];
  },

  set(key, value) {
    const data = readConfig();
    data[key] = value;
    writeConfig(data);
  },

  delete(key) {
    const data = readConfig();
    delete data[key];
    writeConfig(data);
  },

  getConversationRecords() {
    initializeWorkDirectoryFiles();
    const recordsPath = getConversationRecordsPath();
    const records = readJsonFile(recordsPath, []);
    return Array.isArray(records) ? records : [];
  },

  setConversationRecords(records) {
    initializeWorkDirectoryFiles();
    const recordsPath = getConversationRecordsPath();
    writeJsonFile(recordsPath, Array.isArray(records) ? records : []);
  },

  clearConversationRecords() {
    this.setConversationRecords([]);
  }
};

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

store.getCustomTemplates = function() {
  return this.get('customTemplates', []);
};

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

store.deleteCustomTemplate = function(id) {
  const templates = this.getCustomTemplates();
  const filtered = templates.filter(t => t.id !== id);
  this.set('customTemplates', filtered);
};

store.getQuickAccessTemplates = function() {
  return this.get('quickAccessTemplates', null);
};

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
