const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDeviceIdentity,
  getOrCreateDeviceIdentity
} = require('../pet-device-identity');

test('creates a stable hashed client id from local machine inputs', () => {
  const first = createDeviceIdentity({
    platform: 'darwin',
    arch: 'arm64',
    hostname: 'private-host',
    username: 'wangjing',
    dataDirectory: '/Users/wangjing/.desktop-pet',
    salt: 'desktop-pet'
  });
  const second = createDeviceIdentity({
    platform: 'darwin',
    arch: 'arm64',
    hostname: 'private-host',
    username: 'wangjing',
    dataDirectory: '/Users/wangjing/.desktop-pet',
    salt: 'desktop-pet'
  });

  assert.equal(first.clientId, second.clientId);
  assert.match(first.clientId, /^pet_[a-f0-9]{24}$/);
  assert.equal(first.shortId, first.clientId.slice(-8));
  assert.equal(first.clientId.includes('private-host'), false);
  assert.equal(first.clientId.includes('wangjing'), false);
});

test('persists generated client id and reuses existing id', () => {
  const values = new Map();
  const store = {
    dataDirectory: '/tmp/desktop-pet-test',
    get(key) {
      return values.get(key);
    },
    set(key, value) {
      values.set(key, value);
    }
  };

  const first = getOrCreateDeviceIdentity(store, {
    platform: 'win32',
    arch: 'x64',
    hostname: 'host-a',
    username: 'user-a',
    salt: 'desktop-pet'
  });
  const second = getOrCreateDeviceIdentity(store, {
    platform: 'win32',
    arch: 'x64',
    hostname: 'host-b',
    username: 'user-b',
    salt: 'desktop-pet'
  });

  assert.equal(first.clientId, second.clientId);
  assert.equal(values.get('petNetworkClientId'), first.clientId);
});
