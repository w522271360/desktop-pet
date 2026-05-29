const EventEmitter = require('events');
const WebSocket = require('ws');
const { getOrCreateDeviceIdentity } = require('./pet-device-identity');
const {
  MESSAGE_TYPES,
  createEnvelope,
  parseEnvelope,
  validateChatPayload
} = require('./pet-network-protocol');

function normalizeWsUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('http://')) return value.replace(/^http:\/\//, 'ws://');
  if (value.startsWith('https://')) return value.replace(/^https:\/\//, 'wss://');
  return value;
}

function createDefaultState(overrides = {}) {
  return {
    mode: 'personal',
    status: 'disabled',
    connected: false,
    serverUrl: '',
    error: '',
    users: [],
    clientId: '',
    nickname: '',
    ...overrides
  };
}

class PetNetworkClient extends EventEmitter {
  constructor({
    store,
    WebSocketCtor = WebSocket,
    reconnect = true,
    appVersion = '2.2.0'
  } = {}) {
    super();
    this.store = store;
    this.WebSocketCtor = WebSocketCtor;
    this.reconnect = reconnect;
    this.appVersion = appVersion;
    this.socket = null;
    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.state = createDefaultState();
  }

  readConfig() {
    const mode = this.store?.get?.('petAppMode', 'personal') || 'personal';
    return {
      mode,
      enabled: this.store?.get?.('petNetworkEnabled', false) === true,
      serverUrl: normalizeWsUrl(this.store?.get?.('petServerUrl', '')),
      clientToken: this.store?.get?.('petNetworkClientToken', '') || '',
      nickname: this.store?.get?.('petNetworkNickname', '') || this.store?.get?.('userDisplayName', '') || '桌宠用户',
      character: this.store?.get?.('petCharacter', 'bubu') || 'bubu'
    };
  }

  setState(nextState) {
    this.state = {
      ...this.state,
      ...nextState
    };
    this.emit('state', this.getState());
    return this.state;
  }

  getState() {
    return {
      ...this.state,
      users: [...(this.state.users || [])]
    };
  }

  async connect() {
    clearTimeout(this.reconnectTimer);
    this.manualDisconnect = false;
    const config = this.readConfig();
    const identity = getOrCreateDeviceIdentity(this.store);

    this.setState({
      mode: config.mode,
      serverUrl: config.serverUrl,
      clientId: identity.clientId,
      nickname: config.nickname
    });

    if (config.mode !== 'network' || !config.enabled) {
      this.closeSocket();
      return this.setState({ status: 'disabled', connected: false, error: '' });
    }

    if (!config.serverUrl) {
      return this.setState({ status: 'error', connected: false, error: '请先配置服务端地址' });
    }

    this.closeSocket();
    this.setState({ status: 'connecting', connected: false, error: '' });

    return await new Promise(resolve => {
      let settled = false;
      const settle = state => {
        if (settled) return;
        settled = true;
        resolve(state);
      };

      try {
        const socket = new this.WebSocketCtor(config.serverUrl);
        this.socket = socket;

        socket.onopen = () => {
          const registration = createEnvelope(MESSAGE_TYPES.PET_REGISTER, {
            clientId: identity.clientId,
            clientToken: config.clientToken,
            payload: {
              nickname: config.nickname,
              character: config.character,
              appVersion: this.appVersion,
              mode: 'network'
            }
          });
          socket.send(JSON.stringify(registration));
        };

        socket.onmessage = event => {
          this.handleMessage(event.data);
          settle(this.getState());
        };

        socket.onerror = error => {
          const message = error?.message || '联网服务连接失败';
          const state = this.setState({ status: 'error', connected: false, error: message });
          settle(state);
        };

        socket.onclose = () => {
          if (this.manualDisconnect) {
            this.setState({ status: 'disabled', connected: false });
            return;
          }
          this.setState({ status: 'reconnecting', connected: false, error: '联网服务已断开' });
          this.scheduleReconnect();
        };
      } catch (error) {
        const state = this.setState({ status: 'error', connected: false, error: error.message });
        settle(state);
      }

      setTimeout(() => {
        if (!settled && this.state.status === 'connecting') {
          settle(this.getState());
        }
      }, 250);
    });
  }

  closeSocket() {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch (error) {
      // Best effort shutdown only.
    }
  }

  disconnect() {
    this.manualDisconnect = true;
    clearTimeout(this.reconnectTimer);
    this.closeSocket();
    return this.setState({ status: 'disabled', connected: false, error: '' });
  }

  scheduleReconnect() {
    if (!this.reconnect || this.manualDisconnect) return;
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(30000, 1000 * (2 ** this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  handleMessage(raw) {
    let envelope;
    try {
      envelope = parseEnvelope(raw);
    } catch (error) {
      this.setState({ error: error.message });
      return;
    }

    if (envelope.type === MESSAGE_TYPES.PET_REGISTERED) {
      this.reconnectAttempt = 0;
      this.setState({
        status: 'connected',
        connected: true,
        error: '',
        users: envelope.payload.clients || []
      });
      this.emit('users', this.state.users);
      return;
    }

    if (envelope.type === MESSAGE_TYPES.PET_PRESENCE || envelope.type === MESSAGE_TYPES.USERS_LIST) {
      this.setState({ users: envelope.payload.clients || [] });
      this.emit('users', this.state.users);
      return;
    }

    if (envelope.type === MESSAGE_TYPES.PET_CHAT_RECEIVED) {
      this.emit('chat', envelope.payload);
      return;
    }

    if (envelope.type === MESSAGE_TYPES.SERVER_NOTICE) {
      this.emit('notice', envelope.payload);
      return;
    }

    if (envelope.type === MESSAGE_TYPES.ERROR) {
      this.setState({ status: 'error', connected: false, error: envelope.payload.message || '联网服务错误' });
    }
  }

  sendChat(payload) {
    if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
      return { success: false, error: '联网服务未连接' };
    }
    try {
      const validPayload = validateChatPayload(payload);
      this.socket.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.PET_CHAT, {
        clientId: this.state.clientId,
        payload: validPayload
      })));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

function createPetNetworkClient(options) {
  return new PetNetworkClient(options);
}

module.exports = {
  PetNetworkClient,
  createPetNetworkClient,
  normalizeWsUrl
};
