const { app, BrowserWindow, ipcMain, desktopCapturer, Menu, screen, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const config = require('./config');
const store = require('./store');
const apiService = require('./api-service');
const piAgentService = require('./pi-agent-service');
const { notifyApiConfigsChanged } = require('./config-change-notifier');
const { getImageExtension } = require('./generated-image-export');
const { resolveConversationSavePath } = require('./conversation-save-path');
const { createReminderManager } = require('./reminder-manager');
const { getPortableRelaunchOptions } = require('./portable-restart');
const { createPetNetworkClient } = require('./pet-network-client');

const APP_NAME = '桌面小助手';
app.setName(APP_NAME);
if (process.platform === 'win32') {
  app.setAppUserModelId('com.king.desktop-helper');
}

// 启用 Web Speech API 所需的实验性功能
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

let petWindow = null;
let chatWindow = null;
let chatWindowReady = false;
let pendingExternalPaste = null;
let settingsWindow = null;
let screenshotSelectorWindow = null;
let reminderCheckTimer = null;
let activeReminderId = null;
let isAppQuitting = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windowToFocus = chatWindow || settingsWindow || petWindow;
    if (!windowToFocus || windowToFocus.isDestroyed()) return;
    if (windowToFocus.isMinimized()) windowToFocus.restore();
    windowToFocus.show();
    windowToFocus.focus();
  });
}

const reminderManager = createReminderManager(store);
const petNetworkClient = createPetNetworkClient({
  store,
  appVersion: app.getVersion()
});

function getLaunchAtLoginOptions(enabled) {
  const options = {
    openAtLogin: Boolean(enabled),
    openAsHidden: true
  };

  if (!app.isPackaged) {
    options.path = process.execPath;
    options.args = [app.getAppPath()];
  }

  return options;
}

function readLaunchAtLoginState() {
  try {
    return {
      supported: true,
      enabled: app.getLoginItemSettings(getLaunchAtLoginOptions(true)).openAtLogin,
      success: true
    };
  } catch (error) {
    return {
      supported: false,
      enabled: false,
      success: false,
      error: error.message
    };
  }
}

function applyLaunchAtLogin(enabled) {
  try {
    app.setLoginItemSettings(getLaunchAtLoginOptions(enabled));
    const state = readLaunchAtLoginState();
    store.set('launchAtLogin', state.enabled);
    return state;
  } catch (error) {
    return {
      supported: false,
      enabled: false,
      success: false,
      error: error.message
    };
  }
}

// 获取应用图标路径（支持多种格式回退）
function getAppIcon() {
  const iconFormats = process.platform === 'win32'
      ? ['icon.ico', 'icon.png', 'icon.svg']
      : ['icon.png', 'icon.ico', 'icon.svg'];
  for (const format of iconFormats) {
    const iconPath = path.join(__dirname, 'assets', format);
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }
  return null; // 如果都不存在，返回 null，使用系统默认图标
}

// 宠物大小配置（放在顶部方便引用）
const petSizeConfig = {
  small: { width: 238, height: 105 },
  medium: { width: 262, height: 132 },
  large: { width: 288, height: 163 }
};

function getPetWindowSize(size = store.get('petSize', 'medium'), expanded = false) {
  const compact = petSizeConfig[size] || petSizeConfig.medium;
  if (!expanded) return compact;

  return {
    width: Math.max(compact.width, 330),
    height: compact.height + 118
  };
}

function resizePetWindowForReminder(expanded) {
  if (!petWindow || petWindow.isDestroyed()) return;

  const petSize = store.get('petSize', 'medium');
  const nextSize = getPetWindowSize(petSize, expanded);
  const bounds = petWindow.getBounds();
  const anchorY = bounds.y + bounds.height;

  petWindow.setBounds({
    x: bounds.x,
    y: Math.round(anchorY - nextSize.height),
    width: nextSize.width,
    height: nextSize.height
  });
}

function serializeReminder(reminder) {
  if (!reminder) return null;
  return {
    id: reminder.id,
    title: reminder.title,
    note: reminder.note || '',
    scheduledAt: reminder.scheduledAt,
    recurrence: reminder.recurrence || { frequency: 'none' },
    enabled: reminder.enabled !== false,
    status: reminder.status || 'scheduled',
    acknowledgedAt: reminder.acknowledgedAt || null,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt
  };
}

function broadcastReminderListChanged() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('reminders-changed');
  }
}

function sendToWindow(windowRef, channel, payload) {
  if (windowRef && !windowRef.isDestroyed()) {
    windowRef.webContents.send(channel, payload);
  }
}

function broadcastPetNetwork(channel, payload) {
  [petWindow, chatWindow, settingsWindow].forEach(win => sendToWindow(win, channel, payload));
}

function broadcastPetNetworkState() {
  broadcastPetNetwork('pet-network-state-changed', petNetworkClient.getState());
}

function showPetNetworkBubble(payload) {
  resizePetWindowForReminder(true);
  sendToWindow(petWindow, 'pet-network-bubble', {
    title: payload?.title || '联网消息',
    text: payload?.text || '',
    from: payload?.from || null,
    sentAt: payload?.sentAt || new Date().toISOString()
  });
}

function showPetChatBubble(payload) {
  if (!payload?.text) return;
  resizePetWindowForReminder(true);
  sendToWindow(petWindow, 'pet-chat-bubble', {
    title: payload.title || '小秘书',
    text: payload.text,
    meta: payload.meta || '',
    variant: payload.variant || 'chat'
  });
}

petNetworkClient.on('state', broadcastPetNetworkState);
petNetworkClient.on('users', users => {
  broadcastPetNetwork('pet-network-users-changed', users);
});
petNetworkClient.on('chat', payload => {
  broadcastPetNetwork('pet-network-chat', payload);
});
petNetworkClient.on('notice', payload => {
  showPetNetworkBubble(payload);
  broadcastPetNetwork('pet-network-notice', payload);
});

function sendActiveReminderToPet() {
  if (!petWindow || petWindow.isDestroyed()) return;

  const dueReminders = reminderManager.getDueReminders(new Date());
  if (dueReminders.length === 0) {
    activeReminderId = null;
    resizePetWindowForReminder(false);
    petWindow.webContents.send('reminder-cleared');
    return;
  }

  const activeReminder = dueReminders.find(reminder => reminder.id === activeReminderId) || dueReminders[0];
  activeReminderId = activeReminder.id;
  reminderManager.markReminderDue(activeReminder.id);
  resizePetWindowForReminder(true);
  petWindow.webContents.send('reminder-due', {
    reminder: serializeReminder(activeReminder),
    queueCount: Math.max(0, dueReminders.length - 1)
  });
}

function startReminderScheduler() {
  if (reminderCheckTimer) return;
  sendActiveReminderToPet();
  reminderCheckTimer = setInterval(sendActiveReminderToPet, 30 * 1000);
}

function stopReminderScheduler() {
  if (!reminderCheckTimer) return;
  clearInterval(reminderCheckTimer);
  reminderCheckTimer = null;
}

// 创建透明悬浮宠物窗口
function createPetWindow() {
  const alwaysOnTop = store.get('alwaysOnTop', true);
  const petSize = store.get('petSize', 'medium');
  const sizeConfig = getPetWindowSize(petSize, false);
  const appIcon = getAppIcon();
  
  const options = {
    width: sizeConfig.width,
    height: sizeConfig.height,
    transparent: true,
    frame: false,
    type: 'toolbar',
    alwaysOnTop: process.argv.includes('--dev') ? true : alwaysOnTop,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };
  
  if (appIcon) {
    options.icon = appIcon;
  }
  
  petWindow = new BrowserWindow(options);
  if (process.argv.includes('--dev')) {
    petWindow.setFocusable(true);
    petWindow.setAlwaysOnTop(true, 'screen-saver');
    petWindow.webContents.on('console-message', (event, level, message) => {
      console.log('[pet-console]', message);
    });
    petWindow.webContents.on('before-input-event', (event, input) => {
      console.log('[pet-input]', input.type, input.key || input.code || '');
    });
  }

  // 定位到屏幕右下角
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const x = width - sizeConfig.width - 20; // 距离右边缘20px
  const y = height - sizeConfig.height - 20; // 距离底部20px
  petWindow.setPosition(x, y);
  petWindow.setSkipTaskbar(true);
  if (process.argv.includes('--dev')) {
    console.log('[pet] window-bounds', petWindow.getBounds());
  }

  petWindow.loadFile(path.join(__dirname, 'renderer', 'pet.html'));
  
  if (process.argv.includes('--dev')) {
    petWindow.webContents.openDevTools({ mode: 'detach' });
  }

  petWindow.webContents.once('did-finish-load', () => {
    petWindow.showInactive();
    petWindow.setSkipTaskbar(true);
    sendActiveReminderToPet();
  });

  petWindow.on('closed', () => {
    petWindow = null;
    if (chatWindow) chatWindow.close();
    if (settingsWindow) settingsWindow.close();
  });
}

// 创建对话窗口
function createChatWindow() {
  if (chatWindow) {
    // 如果窗口被最小化，先恢复
    if (chatWindow.isMinimized()) {
      chatWindow.restore();
    }
    // 如果窗口不可见，显示它
    if (!chatWindow.isVisible()) {
      chatWindow.show();
    }
    chatWindow.focus();
    return;
  }

  const appIcon = getAppIcon();
  
  const options = {
    width: config.window.chatWidth,
    height: config.window.chatHeight,
    transparent: false,
    frame: true,
    autoHideMenuBar: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: true,
    title: APP_NAME,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      experimentalFeatures: true  // 启用实验性功能，支持 Web Speech API
    }
  };
  
  if (appIcon) {
    options.icon = appIcon;
  }
  
  chatWindow = new BrowserWindow(options);
  chatWindowReady = false;

  chatWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[chat] did-fail-load', errorCode, errorDescription);
  });
  chatWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[chat] render-process-gone', JSON.stringify(details));
  });

  chatWindow.loadFile(path.join(__dirname, 'renderer', 'chat.html'));

  if (process.argv.includes('--dev')) {
    chatWindow.webContents.openDevTools({ mode: 'detach' });
  }

  chatWindow.on('close', (event) => {
    if (isAppQuitting) return;
    event.preventDefault();
    chatWindow.hide();
  });

  chatWindow.on('closed', () => {
    chatWindow = null;
    chatWindowReady = false;
  });
}

function openChatAndForwardPaste(payload) {
  pendingExternalPaste = payload;
  createChatWindow();

  if (chatWindowReady && chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('external-paste', pendingExternalPaste);
    pendingExternalPaste = null;
  }
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    // 如果窗口被最小化，先恢复
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    // 如果窗口不可见，显示它
    if (!settingsWindow.isVisible()) {
      settingsWindow.show();
    }
    settingsWindow.focus();
    return;
  }

  const appIcon = getAppIcon();
  
  const options = {
    width: config.window.settingsWidth,
    height: config.window.settingsHeight,
    transparent: false,
    frame: true,
    autoHideMenuBar: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: true,
    title: `${APP_NAME} - 设置`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };
  
  if (appIcon) {
    options.icon = appIcon;
  }
  
  settingsWindow = new BrowserWindow(options);

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 保存对话为Markdown
async function saveConversationAsMarkdown(conversation) {
  try {
    const savePath = resolveConversationSavePath(
      store.dataDirectory
    );
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `AI对话_${timestamp}.md`;
    const fullPath = path.join(savePath, filename);

    let markdownContent = '# AI对话记录\n\n';
    markdownContent += `> 创建时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    markdownContent += '---\n\n';

    conversation.forEach((item, index) => {
      markdownContent += `## Question ${index + 1}\n\n`;
      markdownContent += `${item.question}\n\n`;
      markdownContent += `## Answer ${index + 1}\n\n`;
      markdownContent += `模型：${item.model || 'Unknown'}\n\n`;
      markdownContent += `${item.answer}\n\n`;
      markdownContent += '---\n\n';
    });

    fs.writeFileSync(fullPath, markdownContent, 'utf-8');

    return {
      success: true,
      path: fullPath,
      filename: filename,
      directory: savePath
    };
  } catch (error) {
    console.error('保存Markdown失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function getGeneratedImageBytes(image) {
  if (image.base64) {
    return {
      bytes: Buffer.from(image.base64, 'base64'),
      mimeType: image.mimeType || 'image/png'
    };
  }

  const response = await axios.get(image.url, {
    responseType: 'arraybuffer',
    timeout: 60000
  });
  return {
    bytes: Buffer.from(response.data),
    mimeType: response.headers['content-type']?.split(';')[0] || 'image/png'
  };
}

async function withAppWindowsHidden(task) {
  const chatWasVisible = chatWindow && chatWindow.isVisible();
  const settingsWasVisible = settingsWindow && settingsWindow.isVisible();

  if (chatWindow && chatWasVisible) {
    chatWindow.hide();
  }
  if (settingsWindow && settingsWasVisible) {
    settingsWindow.hide();
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    return await task();
  } finally {
    await new Promise(resolve => setTimeout(resolve, 100));

    if (chatWindow && chatWasVisible) {
      chatWindow.show();
      chatWindow.focus();
    }
    if (settingsWindow && settingsWasVisible) {
      settingsWindow.show();
      settingsWindow.focus();
    }
  }
}

async function capturePrimaryScreen() {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.round(display.size.width * scaleFactor),
    height: Math.round(display.size.height * scaleFactor)
  };

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize
  });

  if (sources.length === 0) {
    return { success: false, error: '无法获取屏幕' };
  }

  const screenshot = sources[0].thumbnail.toPNG();
  return {
    success: true,
    data: screenshot.toString('base64'),
    imageSize: sources[0].thumbnail.getSize(),
    displayBounds: display.bounds
  };
}

// 截取屏幕（自动隐藏对话窗口和设置窗口）
async function captureScreen() {
  try {
    return await withAppWindowsHidden(capturePrimaryScreen);
  } catch (error) {
    console.error('截屏失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function selectScreenshotRegion() {
  try {
    const captured = await withAppWindowsHidden(capturePrimaryScreen);
    if (!captured.success) return captured;

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;
    const imageSize = captured.imageSize;

    const selection = await new Promise((resolve) => {
      if (screenshotSelectorWindow && !screenshotSelectorWindow.isDestroyed()) {
        screenshotSelectorWindow.close();
      }

      screenshotSelectorWindow = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width,
        height,
        frame: false,
        transparent: false,
        resizable: false,
        movable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        fullscreenable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });

      const cleanup = () => {
        ipcMain.removeListener('screenshot-selection-finished', finishHandler);
        ipcMain.removeListener('screenshot-selection-cancelled', cancelHandler);
        if (screenshotSelectorWindow && !screenshotSelectorWindow.isDestroyed()) {
          screenshotSelectorWindow.close();
        }
        screenshotSelectorWindow = null;
      };

      const finishHandler = (event, rect) => {
        if (!screenshotSelectorWindow || event.sender !== screenshotSelectorWindow.webContents) return;
        cleanup();
        resolve({ canceled: false, rect });
      };

      const cancelHandler = (event) => {
        if (!screenshotSelectorWindow || event.sender !== screenshotSelectorWindow.webContents) return;
        cleanup();
        resolve({ canceled: true });
      };

      ipcMain.on('screenshot-selection-finished', finishHandler);
      ipcMain.on('screenshot-selection-cancelled', cancelHandler);

      screenshotSelectorWindow.on('closed', () => {
        ipcMain.removeListener('screenshot-selection-finished', finishHandler);
        ipcMain.removeListener('screenshot-selection-cancelled', cancelHandler);
        screenshotSelectorWindow = null;
        resolve({ canceled: true });
      });

      screenshotSelectorWindow.loadFile(path.join(__dirname, 'renderer', 'screenshot-selector.html'));
      screenshotSelectorWindow.webContents.once('did-finish-load', () => {
        screenshotSelectorWindow.webContents.send('screenshot-selection-data', {
          image: captured.data,
          imageSize,
          viewportSize: { width, height }
        });
      });
    });

    if (selection.canceled) {
      return { success: false, canceled: true };
    }

    const rect = selection.rect;
    if (!rect || rect.width < 2 || rect.height < 2) {
      return { success: false, canceled: true };
    }

    const scaleX = imageSize.width / width;
    const scaleY = imageSize.height / height;
    const cropRect = {
      x: Math.max(0, Math.round(rect.x * scaleX)),
      y: Math.max(0, Math.round(rect.y * scaleY)),
      width: Math.max(1, Math.round(rect.width * scaleX)),
      height: Math.max(1, Math.round(rect.height * scaleY))
    };

    const image = nativeImage.createFromBuffer(Buffer.from(captured.data, 'base64'));
    const cropped = image.crop(cropRect).toPNG();
    return {
      success: true,
      data: cropped.toString('base64'),
      mimeType: 'image/png',
      rect: cropRect
    };
  } catch (error) {
    console.error('区域截图失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// IPC通信处理
ipcMain.on('open-chat', () => {
  createChatWindow();
});

ipcMain.on('paste-to-chat', () => {
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    openChatAndForwardPaste({
      type: 'image',
      base64: image.toPNG().toString('base64'),
      mimeType: 'image/png'
    });
    return;
  }

  const text = clipboard.readText();
  if (text) {
    openChatAndForwardPaste({ type: 'text', text });
    return;
  }

  createChatWindow();
});

ipcMain.on('focus-pet-window', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (!petWindow.isVisible()) {
    petWindow.showInactive();
  }
  petWindow.moveTop();
  petWindow.setSkipTaskbar(true);
});

ipcMain.on('chat-ready-for-paste', () => {
  chatWindowReady = true;

  if (!pendingExternalPaste || !chatWindow || chatWindow.isDestroyed()) return;
  chatWindow.webContents.send('external-paste', pendingExternalPaste);
  pendingExternalPaste = null;
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('quit-app', () => {
  isAppQuitting = true;
  app.quit();
});

ipcMain.on('restart-app', () => {
  isAppQuitting = true;
  app.relaunch(getPortableRelaunchOptions() || undefined);
  app.exit(0);
});

ipcMain.on('drag-pet-window', (event, { screenX, screenY, offsetX, offsetY }) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setPosition(Math.round(screenX - offsetX), Math.round(screenY - offsetY));
});

ipcMain.on('pet-interaction-event', (event, interaction) => {
  if (process.argv.includes('--dev')) {
    console.log('[pet]', interaction);
  }
});

ipcMain.handle('get-reminders', () => {
  return reminderManager.listReminders().map(serializeReminder);
});

ipcMain.handle('save-reminder', (event, { reminder }) => {
  try {
    const savedReminder = reminderManager.saveReminder(reminder);
    broadcastReminderListChanged();
    sendActiveReminderToPet();
    return { success: true, reminder: serializeReminder(savedReminder) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-reminder', (event, { id }) => {
  const deleted = reminderManager.deleteReminder(id);
  if (activeReminderId === id) {
    activeReminderId = null;
  }
  broadcastReminderListChanged();
  sendActiveReminderToPet();
  return { success: deleted };
});

ipcMain.handle('acknowledge-reminder', (event, { id }) => {
  const acknowledged = reminderManager.acknowledgeReminder(id);
  if (activeReminderId === id) {
    activeReminderId = null;
  }
  broadcastReminderListChanged();
  sendActiveReminderToPet();
  return {
    success: Boolean(acknowledged),
    reminder: serializeReminder(acknowledged)
  };
});

ipcMain.handle('send-message', async (event, { messages }) => {
  return await apiService.sendMessage(messages);
});

ipcMain.handle('send-pi-agent-message', async (event, payload = {}) => {
  const requestId = String(payload.requestId || '').trim() || `pi-agent-${Date.now()}`;
  const sendPiEvent = (agentEvent) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('pi-agent-event', {
        requestId,
        ...agentEvent
      });
    }
  };

  return await piAgentService.sendMessage({
    requestId,
    prompt: payload.prompt,
    cwd: payload.cwd,
    history: payload.history,
    onEvent: sendPiEvent
  });
});

ipcMain.handle('get-pi-agent-status', () => {
  return piAgentService.getStatus();
});

ipcMain.handle('cancel-pi-agent-message', async (event, payload = {}) => {
  return await piAgentService.cancelMessage(payload.requestId);
});

ipcMain.handle('save-conversation', async (event, { conversation }) => {
  return await saveConversationAsMarkdown(conversation);
});

ipcMain.handle('get-conversations', () => {
  return store.getConversations();
});

ipcMain.handle('get-conversation', (event, { id }) => {
  return store.getConversation(id);
});

ipcMain.handle('save-conversation-record', (event, { conversation }) => {
  return store.saveConversationRecord(conversation);
});

ipcMain.handle('rename-conversation', (event, { id, title }) => {
  const conversation = store.renameConversation(id, title);
  return conversation ? { success: true, conversation } : { success: false, error: '未找到对话' };
});

ipcMain.handle('delete-conversation-record', (event, { id }) => {
  return { success: store.deleteConversationRecord(id) };
});

ipcMain.handle('capture-screen', async () => {
  return await captureScreen();
});

ipcMain.handle('select-screenshot-region', async () => {
  return await selectScreenshotRegion();
});

ipcMain.handle('analyze-screenshot', async (event, { base64Image }) => {
  return await apiService.analyzeScreenshot(base64Image);
});

ipcMain.handle('analyze-image', async (event, { base64Image, prompt, mimeType }) => {
  return await apiService.analyzeImage(base64Image, prompt, mimeType);
});

ipcMain.handle('generate-image', async (event, { prompt, base64Image, mimeType }) => {
  return await apiService.generateImage(prompt, base64Image, mimeType);
});

ipcMain.handle('copy-generated-image', async (event, { image }) => {
  try {
    const { bytes } = await getGeneratedImageBytes(image);
    clipboard.writeImage(nativeImage.createFromBuffer(bytes));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-generated-image', async (event, { image }) => {
  try {
    const { bytes, mimeType } = await getGeneratedImageBytes(image);
    const extension = getImageExtension(mimeType);
    const result = await dialog.showSaveDialog(chatWindow, {
      title: '保存生成的图片',
      defaultPath: `generated-image-${Date.now()}.${extension}`,
      filters: [{ name: '图片', extensions: [extension] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, bytes);
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-directory', async (event, { defaultPath } = {}) => {
  const result = await dialog.showOpenDialog(settingsWindow || chatWindow || petWindow, {
    title: '选择 Agent 工作目录',
    properties: ['openDirectory'],
    defaultPath: typeof defaultPath === 'string' && defaultPath.trim() ? defaultPath.trim() : undefined
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return {
    canceled: false,
    path: result.filePaths[0]
  };
});

// 测试 API 配置
ipcMain.handle('test-api-config', async (event, { apiConfig }) => {
  return await apiService.testConnection(apiConfig);
});

// 配置管理
ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('get-api-configs', () => {
  return store.get('apiConfigs', []);
});

ipcMain.handle('get-active-config', () => {
  return store.getActiveConfig();
});

ipcMain.handle('add-api-config', (event, { config: newConfig }) => {
  const createdConfig = store.addConfig(newConfig);
  notifyApiConfigsChanged(chatWindow);
  return createdConfig;
});

ipcMain.handle('update-api-config', (event, { id, updates }) => {
  const updatedConfig = store.updateConfig(id, updates);
  if (updatedConfig) {
    notifyApiConfigsChanged(chatWindow);
  }
  return updatedConfig;
});

ipcMain.handle('delete-api-config', (event, { id }) => {
  store.deleteConfig(id);
  notifyApiConfigsChanged(chatWindow);
  return { success: true };
});

ipcMain.handle('set-active-config', (event, { id }) => {
  const changed = store.setActiveConfig(id);
  if (changed) {
    notifyApiConfigsChanged(chatWindow);
  }
  return changed;
});

// Store 相关
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  
  if (key === 'alwaysOnTop' && petWindow) {
    petWindow.setAlwaysOnTop(value);
  }
  
  return true;
});

ipcMain.handle('store-delete', (event, key) => {
  store.delete(key);
  return true;
});

ipcMain.handle('launch-at-login-get', () => {
  const state = readLaunchAtLoginState();
  if (state.success) {
    store.set('launchAtLogin', state.enabled);
  }
  return state;
});

ipcMain.handle('launch-at-login-set', (event, { enabled }) => {
  return applyLaunchAtLogin(enabled);
});

// ========== 联网服务 IPC 处理 ==========

ipcMain.handle('pet-network-get-state', () => {
  return petNetworkClient.getState();
});

ipcMain.handle('pet-network-get-users', () => {
  return petNetworkClient.getState().users;
});

ipcMain.handle('pet-network-connect', async () => {
  const state = await petNetworkClient.connect();
  broadcastPetNetworkState();
  return state;
});

ipcMain.handle('pet-network-disconnect', () => {
  const state = petNetworkClient.disconnect();
  broadcastPetNetworkState();
  return state;
});

ipcMain.handle('pet-network-set-mode', async (event, { mode }) => {
  const nextMode = mode === 'network' ? 'network' : 'personal';
  store.set('petAppMode', nextMode);
  if (nextMode === 'personal') {
    petNetworkClient.disconnect();
  } else if (store.get('petNetworkEnabled', false)) {
    await petNetworkClient.connect();
  }
  broadcastPetNetworkState();
  return petNetworkClient.getState();
});

ipcMain.handle('pet-network-update-config', async (event, { config: networkConfig }) => {
  const allowedKeys = [
    'petAppMode',
    'petNetworkEnabled',
    'petServerUrl',
    'petNetworkClientToken',
    'petNetworkNickname'
  ];
  allowedKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(networkConfig || {}, key)) {
      store.set(key, networkConfig[key]);
    }
  });

  if (store.get('petAppMode', 'personal') === 'network' && store.get('petNetworkEnabled', false)) {
    await petNetworkClient.connect();
  } else {
    petNetworkClient.disconnect();
  }

  broadcastPetNetworkState();
  return petNetworkClient.getState();
});

ipcMain.handle('pet-network-send-chat', (event, payload) => {
  return petNetworkClient.sendChat(payload);
});

ipcMain.on('pet-network-bubble-closed', () => {
  if (!activeReminderId) {
    resizePetWindowForReminder(false);
  }
});

ipcMain.on('pet-chat-bubble', (event, payload) => {
  showPetChatBubble(payload);
});

ipcMain.on('pet-chat-bubble-clear', () => {
  sendToWindow(petWindow, 'pet-chat-bubble-clear');
  if (!activeReminderId) {
    resizePetWindowForReminder(false);
  }
});

// ========== 主题相关 IPC 处理 ==========

// 广播主题变化到所有窗口
ipcMain.on('theme-changed', (event, isDarkMode) => {
  // 广播到所有窗口
  const windows = [petWindow, chatWindow, settingsWindow];
  windows.forEach(win => {
    if (win && !win.isDestroyed() && win.webContents !== event.sender) {
      win.webContents.send('theme-changed', isDarkMode);
    }
  });
});

// ========== 宠物相关 IPC 处理 ==========

// 宠物图片大小配置（与窗口大小对应）
const petImageSizes = { small: 72, medium: 92, large: 116 };

// 更新宠物图片
ipcMain.on('update-pet-image', (event, imagePath) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet-image-updated', imagePath);
  }
});

ipcMain.on('update-pet-character', (event, character) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet-character-updated', character);
  }
});

// 更新宠物大小
ipcMain.on('update-pet-size', (event, size) => {
  if (petWindow && !petWindow.isDestroyed()) {
    const windowSize = getPetWindowSize(size, Boolean(activeReminderId));
    const imageSize = petImageSizes[size] || petImageSizes.medium;
    petWindow.setSize(windowSize.width, windowSize.height);
    petWindow.webContents.send('pet-size-updated', imageSize);
    sendActiveReminderToPet();
  }
});

// ========== 对话界面设置 IPC 处理 ==========

// 更新聊天主题色
ipcMain.on('update-chat-theme', (event, theme) => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('chat-theme-updated', theme);
  }
});

// 更新聊天字体大小
ipcMain.on('update-chat-font-size', (event, fontSize) => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('chat-font-size-updated', fontSize);
  }
});

// ========== 提示词模板相关 IPC 处理 ==========

// 获取预设模板配置
ipcMain.handle('get-builtin-templates', () => {
  try {
    const templatePath = path.join(__dirname, 'config', 'prompt-templates.json');
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf-8');
      return JSON.parse(content);
    }
    return { categories: [], quickAccess: [], templates: [] };
  } catch (error) {
    console.error('读取模板配置失败:', error);
    return { categories: [], quickAccess: [], templates: [] };
  }
});

// 获取用户自定义模板
ipcMain.handle('get-custom-templates', () => {
  return store.getCustomTemplates();
});

// 添加自定义模板
ipcMain.handle('add-custom-template', (event, { template }) => {
  return store.addCustomTemplate(template);
});

// 更新自定义模板
ipcMain.handle('update-custom-template', (event, { id, updates }) => {
  return store.updateCustomTemplate(id, updates);
});

// 删除自定义模板
ipcMain.handle('delete-custom-template', (event, { id }) => {
  store.deleteCustomTemplate(id);
  return { success: true };
});

// 获取快捷访问模板列表
ipcMain.handle('get-quick-access-templates', () => {
  return store.getQuickAccessTemplates();
});

// 设置快捷访问模板列表
ipcMain.handle('set-quick-access-templates', (event, { templateIds }) => {
  store.setQuickAccessTemplates(templateIds);
  return { success: true };
});

// 创建自定义菜单
function createCustomMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // macOS 需要应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '关于', role: 'about' },
        { type: 'separator' },
        { label: '设置', click: () => { if (settingsWindow) settingsWindow.show(); else createSettingsWindow(); } },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    }] : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        { label: '设置', click: () => { if (settingsWindow) settingsWindow.show(); else createSettingsWindow(); } },
        { type: 'separator' },
        isMac ? { label: '关闭窗口', role: 'close' } : { label: '退出', role: 'quit' }
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '删除', role: 'delete' },
        { type: 'separator' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { label: '前置所有窗口', role: 'front' },
          { type: 'separator' },
          { label: '窗口', role: 'window' }
        ] : [
          { label: '关闭', role: 'close' }
        ])
      ]
    },
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '查看文档',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/');
          }
        },
        { type: 'separator' },
        { label: `关于 ${APP_NAME}`, click: () => showAboutDialog() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 关于对话框
function showAboutDialog() {
  const { dialog } = require('electron');
  dialog.showMessageBox({
    type: 'info',
    title: `关于 ${APP_NAME}`,
    message: APP_NAME,
    detail: `版本: 2.2.0\n作者: king.wang\n\n多模态${APP_NAME}。`,
    buttons: ['确定']
  });
}

// 应用生命周期
app.whenReady().then(async () => {
  // Windows 版本不显示原生菜单栏，避免顶部出现“文件/编辑/视图”等系统菜单。
  Menu.setApplicationMenu(null);

  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
    const dockIcon = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(dockIcon)) {
      try {
        app.dock.setIcon(dockIcon);
      } catch (error) {
        console.warn('Failed to set dock icon:', error.message);
      }
    }
  }
  
  createPetWindow();

  if (store.get('petAppMode', 'personal') === 'network' && store.get('petNetworkEnabled', false)) {
    petNetworkClient.connect().catch(error => {
      console.warn('联网服务自动连接失败:', error.message);
    });
  }

  // 自动打开对话窗口（如果已启用）
  const autoOpenChat = store.get('autoOpenChat', false);
  if (autoOpenChat) {
    setTimeout(() => {
      createChatWindow();
    }, 500); // 延迟500ms，确保宠物窗口先加载完成
  }

  startReminderScheduler();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出时清理
app.on('before-quit', async () => {
  isAppQuitting = true;
  stopReminderScheduler();
  
  console.log('👋 应用正在退出...');
});
