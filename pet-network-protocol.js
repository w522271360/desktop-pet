const crypto = require('crypto');

const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_TEXT_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 24;

const MESSAGE_TYPES = Object.freeze({
  PET_REGISTER: 'pet.register',
  PET_REGISTERED: 'pet.registered',
  PET_PRESENCE: 'pet.presence',
  PET_CHAT: 'pet.chat',
  PET_CHAT_RECEIVED: 'pet.chat.received',
  SERVER_NOTICE: 'server.notice',
  USERS_LIST: 'users.list',
  ADMIN_AUTH: 'admin.auth',
  ADMIN_CLIENTS: 'admin.clients',
  ADMIN_NOTICE: 'admin.notice',
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong'
});

const knownMessageTypes = new Set(Object.values(MESSAGE_TYPES));

function createRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

function createEnvelope(type, { requestId, clientId, clientToken, payload = {}, sentAt } = {}) {
  if (!knownMessageTypes.has(type)) {
    throw new Error(`Unknown message type: ${type}`);
  }

  const envelope = {
    type,
    requestId: requestId || createRequestId(),
    payload,
    sentAt: sentAt || new Date().toISOString()
  };

  if (clientId) envelope.clientId = String(clientId);
  if (clientToken) envelope.clientToken = String(clientToken);
  return envelope;
}

function parseEnvelope(raw, { maxBytes = MAX_MESSAGE_BYTES } = {}) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new Error('Message too large');
  }

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid JSON message');
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid message envelope');
  }
  if (!knownMessageTypes.has(envelope.type)) {
    throw new Error(`Unknown message type: ${envelope.type}`);
  }

  return {
    ...envelope,
    payload: envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  };
}

function sanitizeNickname(value, fallback = '桌宠用户') {
  const cleaned = String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NICKNAME_LENGTH);
  return cleaned || fallback;
}

function sanitizeClientId(value) {
  const clientId = String(value || '').trim();
  if (!/^pet_[a-f0-9]{16,64}$/.test(clientId) && !/^[a-zA-Z0-9_-]{3,80}$/.test(clientId)) {
    throw new Error('Invalid clientId');
  }
  return clientId;
}

function sanitizeOptionalTarget(value) {
  if (!value) return null;
  return sanitizeClientId(value);
}

function validateRegisterPayload(payload = {}) {
  const nickname = sanitizeNickname(payload.nickname, '');
  if (!nickname) {
    throw new Error('Registration nickname is required');
  }

  return {
    nickname,
    character: String(payload.character || 'bubu').slice(0, 32),
    appVersion: String(payload.appVersion || '').slice(0, 32),
    mode: payload.mode === 'network' ? 'network' : 'personal'
  };
}

function validateText(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Message text is required');
  if (text.length > MAX_TEXT_LENGTH) throw new Error('Message text is too long');
  return text;
}

function validateChatPayload(payload = {}) {
  return {
    text: validateText(payload.text),
    targetClientId: sanitizeOptionalTarget(payload.targetClientId)
  };
}

function validateAdminNoticePayload(payload = {}) {
  return {
    text: validateText(payload.text),
    targetClientId: sanitizeOptionalTarget(payload.targetClientId)
  };
}

function createErrorEnvelope(message, code = 'protocol_error') {
  return createEnvelope(MESSAGE_TYPES.ERROR, {
    payload: {
      code,
      message: String(message || 'Unknown error')
    }
  });
}

module.exports = {
  MAX_MESSAGE_BYTES,
  MAX_TEXT_LENGTH,
  MESSAGE_TYPES,
  createEnvelope,
  parseEnvelope,
  sanitizeNickname,
  sanitizeClientId,
  validateRegisterPayload,
  validateChatPayload,
  validateAdminNoticePayload,
  createErrorEnvelope
};
