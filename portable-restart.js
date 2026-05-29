const fs = require('fs');
const path = require('path');

function getPortableRelaunchOptions({
  platform = process.platform,
  env = process.env,
  existsSync = fs.existsSync
} = {}) {
  if (platform !== 'win32') {
    return null;
  }

  const portableExecutableFile = env.PORTABLE_EXECUTABLE_FILE;
  if (!portableExecutableFile || !path.win32.isAbsolute(portableExecutableFile)) {
    return null;
  }

  if (!existsSync(portableExecutableFile)) {
    return null;
  }

  return { execPath: portableExecutableFile };
}

module.exports = { getPortableRelaunchOptions };
