const test = require('node:test');
const assert = require('node:assert/strict');

const { createPetNetworkClient, normalizeWsUrl } = require('../pet-network-client');

test('normalizes server origins to the pet websocket endpoint', () => {
  assert.equal(normalizeWsUrl('ws://127.0.0.1:17890'), 'ws://127.0.0.1:17890/ws');
  assert.equal(normalizeWsUrl('http://example.com'), 'ws://example.com/ws');
  assert.equal(normalizeWsUrl('wss://example.com/custom'), 'wss://example.com/custom');
});

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

test('disconnect reflects personal mode and clears online users', () => {
  const store = {
    get(key, fallback) {
      if (key === 'petAppMode') return 'personal';
      return fallback;
    },
    set() {}
  };

  const client = createPetNetworkClient({ store });
  client.setState({
    mode: 'network',
    status: 'connected',
    connected: true,
    users: [{ clientId: 'client-a' }]
  });

  const state = client.disconnect();
  assert.equal(state.mode, 'personal');
  assert.equal(state.status, 'disabled');
  assert.equal(state.connected, false);
  assert.deepEqual(state.users, []);
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

test('ignores stale socket close events after a newer connection exists', async () => {
  const sockets = [];
  const store = {
    dataDirectory: '/tmp/desktop-pet-client-test',
    get(key, fallback) {
      const values = {
        petAppMode: 'network',
        petNetworkEnabled: true,
        petServerUrl: 'ws://127.0.0.1:17890',
        petNetworkNickname: 'Alice'
      };
      return Object.hasOwn(values, key) ? values[key] : fallback;
    },
    set() {}
  };

  class ManualSocket {
    constructor() {
      this.readyState = 1;
      this.OPEN = 1;
      sockets.push(this);
    }
    send() {}
    close() {}
  }

  const client = createPetNetworkClient({
    store,
    WebSocketCtor: ManualSocket,
    reconnect: false
  });

  await client.connect();
  const staleSocket = sockets[0];
  const staleCloseHandler = staleSocket.onclose;
  await client.connect();
  const currentSocket = sockets[1];

  currentSocket.onmessage({
    data: JSON.stringify({
      type: 'pet.registered',
      payload: { clients: [] },
      sentAt: new Date().toISOString()
    })
  });
  staleCloseHandler();

  assert.equal(client.getState().status, 'connected');
  assert.equal(client.getState().connected, true);
});
