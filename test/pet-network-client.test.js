const test = require('node:test');
const assert = require('node:assert/strict');

const { createPetNetworkClient } = require('../pet-network-client');

test('stays disabled in personal mode and does not open a websocket', async () => {
  let opened = false;
  const store = {
    get(key, fallback) {
      if (key === 'petAppMode') return 'personal';
      return fallback;
    },
    set() {}
  };

  const client = createPetNetworkClient({
    store,
    WebSocketCtor: class {
      constructor() {
        opened = true;
      }
    }
  });

  const state = await client.connect();
  assert.equal(state.status, 'disabled');
  assert.equal(opened, false);
});

test('reports connection errors without throwing to callers', async () => {
  const store = {
    dataDirectory: '/tmp/desktop-pet-client-test',
    get(key, fallback) {
      const values = {
        petAppMode: 'network',
        petNetworkEnabled: true,
        petServerUrl: 'ws://127.0.0.1:9',
        petNetworkNickname: 'Alice'
      };
      return Object.hasOwn(values, key) ? values[key] : fallback;
    },
    set() {}
  };

  class FailingSocket {
    constructor() {
      setTimeout(() => this.onerror?.(new Error('connect failed')), 0);
    }
    close() {}
  }

  const client = createPetNetworkClient({
    store,
    WebSocketCtor: FailingSocket,
    reconnect: false
  });

  const result = await client.connect();
  assert.equal(result.status, 'error');
  assert.match(result.error, /connect failed/i);
});
