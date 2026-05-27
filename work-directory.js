const path = require('path');

function hasConfiguredWorkDirectory(directory) {
  return typeof directory === 'string' && directory.length > 0 && path.isAbsolute(directory);
}

function workDirectoryRequiredError() {
  return '请先在设置 -> 通用设置中选择工作目录，设置后才能使用聊天、图片和保存功能。';
}

module.exports = { hasConfiguredWorkDirectory, workDirectoryRequiredError };
