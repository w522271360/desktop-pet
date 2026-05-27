const fs = require('fs');
const path = require('path');

function appendImageGenerationLog(storePath, event, details = {}) {
  const logPath = path.join(path.dirname(storePath), 'image-generation.log');
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details
  };

  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return logPath;
}

module.exports = { appendImageGenerationLog };
