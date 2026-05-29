const crypto = require('crypto');
const os = require('os');

const STORE_KEY = 'petNetworkClientId';
const DEFAULT_SALT = 'desktop-pet-network-v1';

function createDeviceIdentity({
  platform = process.platform,
  arch = process.arch,
  hostname = os.hostname(),
  username = os.userInfo?.().username || '',
  dataDirectory = '',
  salt = DEFAULT_SALT
} = {}) {
  const source = [
    salt,
    platform,
    arch,
    hostname,
    username,
    dataDirectory
  ].join('|');
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const clientId = `pet_${hash.slice(0, 24)}`;
  return {
    clientId,
    shortId: clientId.slice(-8)
  };
}

function isStoredClientId(value) {
  return typeof value === 'string' && /^pet_[a-f0-9]{24}$/.test(value);
}

function getOrCreateDeviceIdentity(store, overrides = {}) {
  const existing = store?.get?.(STORE_KEY);
  if (isStoredClientId(existing)) {
    return {
      clientId: existing,
      shortId: existing.slice(-8)
    };
  }

  const identity = createDeviceIdentity({
    dataDirectory: store?.dataDirectory || '',
    ...overrides
  });
  store?.set?.(STORE_KEY, identity.clientId);
  return identity;
}

module.exports = {
  STORE_KEY,
  createDeviceIdentity,
  getOrCreateDeviceIdentity
};
