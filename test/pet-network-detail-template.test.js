const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pet network bubble opens the chat network detail panel', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  const chatSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'chat.js'), 'utf8');
  const chatCss = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'chat.css'), 'utf8');

  assert.match(preloadSource, /openPetNetworkDetail: \(payload\) => \{[\s\S]*?ipcRenderer\.send\('open-pet-network-detail', payload\);/);
  assert.match(preloadSource, /onOpenPetNetworkDetail: \(callback\) => \{[\s\S]*?ipcRenderer\.on\('open-pet-network-detail'/);
  assert.match(mainSource, /let pendingPetNetworkDetail = null;/);
  assert.match(mainSource, /function openPetNetworkDetail\(payload\) \{[\s\S]*?createChatWindow\(\);/);
  assert.match(mainSource, /chatWindow\.webContents\.send\('open-pet-network-detail', pendingPetNetworkDetail\);/);
  assert.match(mainSource, /ipcMain\.on\('open-pet-network-detail', \(event, payload\) => \{[\s\S]*?openPetNetworkDetail\(payload\);/);
  assert.match(chatSource, /function openNetworkChatDetail\(payload = \{\}\) \{[\s\S]*?networkChatPanel\?\.classList\.remove\('collapsed'\);/);
  assert.match(chatSource, /const networkMessageItems = new Map\(\);/);
  assert.match(chatSource, /function getNetworkMessageKey\(payload = \{\}, type = 'chat'\)/);
  assert.match(chatSource, /window\.electronAPI\.onOpenPetNetworkDetail\?\.\(openNetworkChatDetail\);/);
  assert.match(chatCss, /\.network-chat-message\.highlight\s*\{[\s\S]*?animation: networkMessageFocus 1\.15s ease;/);
});
