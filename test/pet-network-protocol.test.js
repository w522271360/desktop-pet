const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MESSAGE_TYPES,
  createEnvelope,
  parseEnvelope,
  validateChatPayload,
  validateRegisterPayload,
  validateAdminNoticePayload,
  sanitizeNickname
} = require('../pet-network-protocol');

test('creates a protocol envelope with timestamp and request id', () => {
  const envelope = createEnvelope(MESSAGE_TYPES.PET_CHAT, {
    clientId: 'client-a',
    payload: { text: 'hello' }
  });

  assert.equal(envelope.type, MESSAGE_TYPES.PET_CHAT);
  assert.equal(envelope.clientId, 'client-a');
  assert.ok(envelope.requestId);
  assert.ok(envelope.sentAt);
  assert.deepEqual(envelope.payload, { text: 'hello' });
});

test('parses valid JSON envelopes and rejects malformed payloads', () => {
  const envelope = createEnvelope(MESSAGE_TYPES.PET_REGISTER, {
    clientId: 'client-a',
    payload: { nickname: '小王', character: 'bubu', appVersion: '2.2.0', mode: 'network' }
  });

  assert.equal(parseEnvelope(JSON.stringify(envelope)).type, MESSAGE_TYPES.PET_REGISTER);
  assert.throws(() => parseEnvelope('{bad json'), /invalid json/i);
  assert.throws(() => parseEnvelope(JSON.stringify({ type: 'unknown.type' })), /unknown message type/i);
  assert.throws(() => parseEnvelope('x'.repeat(70 * 1024)), /message too large/i);
});

test('validates registration payloads without leaking raw computer information', () => {
  const payload = validateRegisterPayload({
    nickname: '  桌宠用户  ',
    character: 'bubu',
    appVersion: '2.2.0',
    mode: 'network',
    rawHostname: 'should-not-pass'
  });

  assert.equal(payload.nickname, '桌宠用户');
  assert.equal(payload.character, 'bubu');
  assert.equal(payload.appVersion, '2.2.0');
  assert.equal(payload.mode, 'network');
  assert.equal(Object.hasOwn(payload, 'rawHostname'), false);
  assert.throws(() => validateRegisterPayload({ nickname: '', mode: 'network' }), /nickname/i);
});

test('validates chat and admin notice messages', () => {
  assert.deepEqual(validateChatPayload({ text: ' hi ', targetClientId: 'client-b' }), {
    text: 'hi',
    targetClientId: 'client-b'
  });
  assert.deepEqual(validateChatPayload({ text: 'hello all' }), {
    text: 'hello all',
    targetClientId: null
  });
  assert.throws(() => validateChatPayload({ text: 'x'.repeat(1001) }), /too long/i);
  assert.throws(() => validateChatPayload({ text: '   ' }), /text/i);

  assert.deepEqual(validateAdminNoticePayload({ text: ' notice ', targetClientId: 'client-a' }), {
    text: 'notice',
    targetClientId: 'client-a'
  });
});

test('sanitizes display nicknames for online lists', () => {
  assert.equal(sanitizeNickname(' Alice '), 'Alice');
  assert.equal(sanitizeNickname('<script>'), 'script');
  assert.equal(sanitizeNickname(''), '桌宠用户');
  assert.equal(sanitizeNickname('x'.repeat(40)).length, 24);
});
