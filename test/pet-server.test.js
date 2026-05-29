const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');

const { createPetServer } = require('../pet-server');
const { MESSAGE_TYPES, createEnvelope } = require('../pet-network-protocol');

async function nextMessage(socket) {
  return await new Promise((resolve, reject) => {
    socket.once('message', data => {
      try {
        resolve(JSON.parse(String(data)));
      } catch (error) {
        reject(error);
      }
    });
    socket.once('error', reject);
  });
}

async function openSocket(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return socket;
}

async function registerClient(url, clientId, nickname, clientToken = '') {
  const socket = await openSocket(`${url}/ws`);
  socket.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.PET_REGISTER, {
    clientId,
    clientToken,
    payload: { nickname, character: 'bubu', appVersion: '2.2.0', mode: 'network' }
  })));
  const registered = await nextMessage(socket);
  assert.equal(registered.type, MESSAGE_TYPES.PET_REGISTERED);
  return { socket, registered };
}

test('rejects public binding without admin token', () => {
  assert.throws(() => createPetServer({ host: '0.0.0.0', port: 0 }), /admin-token/i);
});

test('registers clients, publishes presence, and relays chat', async (t) => {
  const service = createPetServer({ host: '127.0.0.1', port: 0, adminToken: 'admin' });
  await service.start();
  t.after(async () => service.stop());

  const url = service.url;
  const alice = await registerClient(url, 'client-a', 'Alice');
  const bob = await registerClient(url, 'client-b', 'Bob');

  const presenceForAlice = await nextMessage(alice.socket);
  assert.equal(presenceForAlice.type, MESSAGE_TYPES.PET_PRESENCE);
  assert.equal(presenceForAlice.payload.client.nickname, 'Bob');

  bob.socket.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.PET_CHAT, {
    clientId: 'client-b',
    payload: { text: 'hello Alice', targetClientId: 'client-a' }
  })));

  const chatForAlice = await nextMessage(alice.socket);
  assert.equal(chatForAlice.type, MESSAGE_TYPES.PET_CHAT_RECEIVED);
  assert.equal(chatForAlice.payload.from.nickname, 'Bob');
  assert.equal(chatForAlice.payload.text, 'hello Alice');

  alice.socket.close();
  bob.socket.close();
});

test('serves admin page and allows authenticated admin notices', async (t) => {
  const service = createPetServer({ host: '127.0.0.1', port: 0, adminToken: 'admin' });
  await service.start();
  t.after(async () => service.stop());

  const alice = await registerClient(service.url, 'client-a', 'Alice');
  const admin = await openSocket(`${service.url}/admin-ws`);
  admin.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.ADMIN_AUTH, {
    payload: { adminToken: 'admin' }
  })));

  const authed = await nextMessage(admin);
  assert.equal(authed.type, MESSAGE_TYPES.ADMIN_CLIENTS);
  assert.equal(authed.payload.clients.length, 1);

  admin.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.ADMIN_NOTICE, {
    payload: { text: 'server hello', targetClientId: 'client-a' }
  })));

  const notice = await nextMessage(alice.socket);
  assert.equal(notice.type, MESSAGE_TYPES.SERVER_NOTICE);
  assert.equal(notice.payload.text, 'server hello');

  const response = await fetch(`${service.url}/admin`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /桌宠服务管理/);

  admin.close();
  alice.socket.close();
});

test('rejects client token mismatch when deployment token is configured', async (t) => {
  const service = createPetServer({
    host: '127.0.0.1',
    port: 0,
    adminToken: 'admin',
    clientToken: 'client-secret'
  });
  await service.start();
  t.after(async () => service.stop());

  const socket = await openSocket(`${service.url}/ws`);
  socket.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.PET_REGISTER, {
    clientId: 'client-a',
    clientToken: 'wrong',
    payload: { nickname: 'Alice', character: 'bubu', appVersion: '2.2.0', mode: 'network' }
  })));

  const error = await nextMessage(socket);
  assert.equal(error.type, MESSAGE_TYPES.ERROR);
  assert.match(error.payload.message, /token/i);
  socket.close();
});
