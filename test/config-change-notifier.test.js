const test = require('node:test');
const assert = require('node:assert/strict');

const { notifyApiConfigsChanged } = require('../config-change-notifier');

test('notifies an open chat window when API configuration changes', () => {
  const messages = [];
  const chatWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (channel) => messages.push(channel)
    }
  };

  assert.equal(notifyApiConfigsChanged(chatWindow), true);
  assert.deepEqual(messages, ['api-configs-changed']);
});

test('does not notify a closed chat window', () => {
  const chatWindow = {
    isDestroyed: () => true,
    webContents: {
      send: () => assert.fail('closed windows must not receive events')
    }
  };

  assert.equal(notifyApiConfigsChanged(chatWindow), false);
  assert.equal(notifyApiConfigsChanged(null), false);
});
