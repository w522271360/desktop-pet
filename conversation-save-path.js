const { hasConfiguredWorkDirectory, workDirectoryRequiredError } = require('./work-directory');

function resolveConversationSavePath(configuredPath, documentsPath) {
  if (hasConfiguredWorkDirectory(configuredPath)) {
    return configuredPath;
  }

  throw new Error(workDirectoryRequiredError());
}

module.exports = { resolveConversationSavePath };
