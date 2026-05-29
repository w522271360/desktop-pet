const test = require('node:test');
const assert = require('node:assert/strict');

const { getPortableRelaunchOptions } = require('../portable-restart');

test('relaunches the outer portable executable on Windows portable builds', () => {
  const portableExecutableFile = 'C:\\Tools\\桌面小助手-便携版.exe';

  assert.deepEqual(
    getPortableRelaunchOptions({
      platform: 'win32',
      env: { PORTABLE_EXECUTABLE_FILE: portableExecutableFile },
      existsSync: (filePath) => filePath === portableExecutableFile
    }),
    { execPath: portableExecutableFile }
  );
});

test('uses default relaunch behavior outside Windows portable builds', () => {
  assert.equal(
    getPortableRelaunchOptions({
      platform: 'darwin',
      env: { PORTABLE_EXECUTABLE_FILE: '/Applications/桌面小助手.app' },
      existsSync: () => true
    }),
    null
  );

  assert.equal(
    getPortableRelaunchOptions({
      platform: 'win32',
      env: {},
      existsSync: () => true
    }),
    null
  );
});
