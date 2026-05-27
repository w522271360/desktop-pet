function notifyApiConfigsChanged(chatWindow) {
  if (!chatWindow || chatWindow.isDestroyed()) {
    return false;
  }

  chatWindow.webContents.send('api-configs-changed');
  return true;
}

module.exports = { notifyApiConfigsChanged };
