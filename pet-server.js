const http = require('http');
const { WebSocketServer } = require('ws');
const {
  MESSAGE_TYPES,
  createEnvelope,
  parseEnvelope,
  validateRegisterPayload,
  validateChatPayload,
  validateAdminNoticePayload,
  createErrorEnvelope,
  sanitizeClientId
} = require('./pet-network-protocol');

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 17890;

function isPublicBind(host) {
  return host === '0.0.0.0' || host === '::' || (!host.startsWith('127.') && host !== 'localhost');
}

function sendJson(socket, envelope) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(envelope));
  }
}

function clientSummary(client) {
  return {
    clientId: client.clientId,
    shortId: client.clientId.slice(-8),
    nickname: client.nickname,
    character: client.character,
    appVersion: client.appVersion,
    connectedAt: client.connectedAt,
    lastSeenAt: client.lastSeenAt,
    ip: client.ip
  };
}

function renderAdminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>桌宠服务管理</title>
  <link rel="stylesheet" href="/server-admin.css">
</head>
<body>
  <main class="admin-shell">
    <section class="admin-header">
      <h1>桌宠服务管理</h1>
      <p>查看在线桌宠，并向全部或指定用户下发气泡消息。</p>
    </section>
    <section class="admin-panel">
      <label>管理员 Token <input id="admin-token" type="password" autocomplete="current-password"></label>
      <button id="connect-admin">连接管理</button>
      <span id="admin-status">未连接</span>
    </section>
    <section class="admin-grid">
      <div>
        <h2>在线用户</h2>
        <div id="clients"></div>
      </div>
      <div>
        <h2>下发消息</h2>
        <select id="target-client"><option value="">全部用户</option></select>
        <textarea id="notice-text" maxlength="1000" placeholder="输入要弹出的气泡消息"></textarea>
        <button id="send-notice">发送</button>
      </div>
    </section>
  </main>
  <script src="/server-admin.js"></script>
</body>
</html>`;
}

function renderAdminJs() {
  return `(() => {
  const tokenInput = document.getElementById('admin-token');
  const connectBtn = document.getElementById('connect-admin');
  const status = document.getElementById('admin-status');
  const clientsEl = document.getElementById('clients');
  const target = document.getElementById('target-client');
  const notice = document.getElementById('notice-text');
  const send = document.getElementById('send-notice');
  let socket;
  function envelope(type, payload) {
    return JSON.stringify({ type, payload, requestId: String(Date.now()), sentAt: new Date().toISOString() });
  }
  function renderClients(clients) {
    clientsEl.innerHTML = '';
    target.innerHTML = '<option value="">全部用户</option>';
    clients.forEach(client => {
      const item = document.createElement('div');
      item.className = 'client-card';
      item.textContent = client.nickname + ' · ' + client.shortId + ' · ' + client.appVersion;
      clientsEl.appendChild(item);
      const option = document.createElement('option');
      option.value = client.clientId;
      option.textContent = client.nickname + ' (' + client.shortId + ')';
      target.appendChild(option);
    });
  }
  connectBtn.addEventListener('click', () => {
    socket?.close();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(protocol + '//' + location.host + '/admin-ws');
    socket.addEventListener('open', () => {
      status.textContent = '认证中';
      socket.send(envelope('admin.auth', { adminToken: tokenInput.value }));
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.type === 'admin.clients') {
        status.textContent = '已连接';
        renderClients(message.payload.clients || []);
      }
      if (message.type === 'error') {
        status.textContent = message.payload.message;
      }
    });
    socket.addEventListener('close', () => {
      status.textContent = '已断开';
    });
  });
  send.addEventListener('click', () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(envelope('admin.notice', { text: notice.value, targetClientId: target.value || null }));
    notice.value = '';
  });
})();`;
}

function renderAdminCss() {
  return `body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;background:#f6f7fb;color:#20242c}.admin-shell{max-width:1000px;margin:0 auto;padding:28px}.admin-header h1{margin:0 0 8px}.admin-panel,.admin-grid>div{background:#fff;border:1px solid #e6e8ef;border-radius:8px;padding:18px;box-shadow:0 10px 24px rgba(30,37,55,.06)}.admin-panel{display:flex;gap:12px;align-items:center}.admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.client-card{padding:10px 0;border-bottom:1px solid #edf0f5}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #d8ddea;border-radius:6px;padding:9px}textarea{min-height:140px;margin:10px 0}button{border:0;border-radius:6px;background:#2563eb;color:white;padding:10px 14px;cursor:pointer}`;
}

function createPetServer(options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const adminToken = options.adminToken || options['admin-token'] || '';
  const clientToken = options.clientToken || options['client-token'] || '';
  const maxClientsPerIp = Number(options.maxClientsPerIp || 20);
  const maxMessagePerMinute = Number(options.maxMessagePerMinute || 120);

  if (isPublicBind(host) && !adminToken) {
    throw new Error('admin-token is required when binding a public address');
  }

  const clientsByClientId = new Map();
  const admins = new Set();
  const connectionMeta = new WeakMap();

  const httpServer = http.createServer((request, response) => {
    if (request.url === '/' || request.url === '/admin') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(renderAdminPage());
      return;
    }
    if (request.url === '/server-admin.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(renderAdminJs());
      return;
    }
    if (request.url === '/server-admin.css') {
      response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      response.end(renderAdminCss());
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  const petWss = new WebSocketServer({ noServer: true });
  const adminWss = new WebSocketServer({ noServer: true });

  function onlineClients() {
    return Array.from(clientsByClientId.values()).map(clientSummary);
  }

  function broadcastToAdmins() {
    const envelope = createEnvelope(MESSAGE_TYPES.ADMIN_CLIENTS, {
      payload: { clients: onlineClients() }
    });
    admins.forEach(socket => sendJson(socket, envelope));
  }

  function broadcastToPets(envelope, exceptClientId = '') {
    clientsByClientId.forEach(client => {
      if (client.clientId !== exceptClientId) {
        sendJson(client.socket, envelope);
      }
    });
  }

  function countIpConnections(ip) {
    let count = 0;
    petWss.clients.forEach(socket => {
      if (connectionMeta.get(socket)?.ip === ip) count += 1;
    });
    return count;
  }

  function checkRate(socket) {
    const meta = connectionMeta.get(socket);
    if (!meta) return true;
    const now = Date.now();
    meta.messageTimes = meta.messageTimes.filter(time => now - time < 60 * 1000);
    meta.messageTimes.push(now);
    return meta.messageTimes.length <= maxMessagePerMinute;
  }

  function closeWithError(socket, message, code = 'protocol_error') {
    sendJson(socket, createErrorEnvelope(message, code));
    setTimeout(() => socket.close(), 10);
  }

  function registerPet(socket, envelope) {
    if (clientToken && envelope.clientToken !== clientToken) {
      closeWithError(socket, 'Invalid client token', 'invalid_client_token');
      return;
    }

    const clientId = sanitizeClientId(envelope.clientId);
    const payload = validateRegisterPayload(envelope.payload);
    const existing = clientsByClientId.get(clientId);
    if (existing && existing.socket !== socket) {
      existing.socket.close();
    }

    const meta = connectionMeta.get(socket);
    const client = {
      socket,
      clientId,
      nickname: payload.nickname,
      character: payload.character,
      appVersion: payload.appVersion,
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      ip: meta?.ip || ''
    };
    meta.clientId = clientId;
    meta.registered = true;
    clientsByClientId.set(clientId, client);

    sendJson(socket, createEnvelope(MESSAGE_TYPES.PET_REGISTERED, {
      clientId,
      payload: {
        client: clientSummary(client),
        clients: onlineClients(),
        serverTime: new Date().toISOString()
      }
    }));

    broadcastToPets(createEnvelope(MESSAGE_TYPES.PET_PRESENCE, {
      payload: { action: 'online', client: clientSummary(client), clients: onlineClients() }
    }), clientId);
    broadcastToAdmins();
  }

  function handlePetMessage(socket, raw) {
    if (!checkRate(socket)) {
      closeWithError(socket, 'Message rate limit exceeded', 'rate_limited');
      return;
    }

    let envelope;
    try {
      envelope = parseEnvelope(raw);
      if (envelope.type === MESSAGE_TYPES.PET_REGISTER) {
        registerPet(socket, envelope);
        return;
      }

      const meta = connectionMeta.get(socket);
      if (!meta?.registered) {
        closeWithError(socket, 'Client must register before sending messages', 'not_registered');
        return;
      }

      const client = clientsByClientId.get(meta.clientId);
      if (client) client.lastSeenAt = new Date().toISOString();

      if (envelope.type === MESSAGE_TYPES.PET_CHAT) {
        const payload = validateChatPayload(envelope.payload);
        const chat = createEnvelope(MESSAGE_TYPES.PET_CHAT_RECEIVED, {
          clientId: meta.clientId,
          payload: {
            from: clientSummary(client),
            text: payload.text,
            targetClientId: payload.targetClientId,
            sentAt: new Date().toISOString()
          }
        });
        if (payload.targetClientId) {
          const target = clientsByClientId.get(payload.targetClientId);
          if (target) sendJson(target.socket, chat);
        } else {
          broadcastToPets(chat, '');
        }
        return;
      }

      if (envelope.type === MESSAGE_TYPES.PING) {
        sendJson(socket, createEnvelope(MESSAGE_TYPES.PONG));
      }
    } catch (error) {
      closeWithError(socket, error.message);
    }
  }

  function handlePetClose(socket) {
    const meta = connectionMeta.get(socket);
    if (!meta?.clientId) return;
    const client = clientsByClientId.get(meta.clientId);
    if (client?.socket === socket) {
      clientsByClientId.delete(meta.clientId);
      broadcastToPets(createEnvelope(MESSAGE_TYPES.PET_PRESENCE, {
        payload: { action: 'offline', client: clientSummary(client), clients: onlineClients() }
      }));
      broadcastToAdmins();
    }
  }

  petWss.on('connection', (socket, request) => {
    const ip = request.socket.remoteAddress || '';
    if (countIpConnections(ip) > maxClientsPerIp) {
      closeWithError(socket, 'Too many connections from this IP', 'too_many_connections');
      return;
    }

    connectionMeta.set(socket, {
      ip,
      registered: false,
      messageTimes: []
    });
    const timer = setTimeout(() => {
      if (!connectionMeta.get(socket)?.registered) {
        closeWithError(socket, 'Client registration timed out', 'register_timeout');
      }
    }, 5000);
    socket.on('message', raw => handlePetMessage(socket, raw));
    socket.on('close', () => {
      clearTimeout(timer);
      handlePetClose(socket);
    });
  });

  adminWss.on('connection', socket => {
    let authed = false;
    socket.on('message', raw => {
      try {
        const envelope = parseEnvelope(raw);
        if (!authed) {
          if (envelope.type !== MESSAGE_TYPES.ADMIN_AUTH || envelope.payload.adminToken !== adminToken) {
            closeWithError(socket, 'Invalid admin token', 'invalid_admin_token');
            return;
          }
          authed = true;
          admins.add(socket);
          broadcastToAdmins();
          return;
        }

        if (envelope.type === MESSAGE_TYPES.ADMIN_NOTICE) {
          const payload = validateAdminNoticePayload(envelope.payload);
          const notice = createEnvelope(MESSAGE_TYPES.SERVER_NOTICE, {
            payload: {
              text: payload.text,
              targetClientId: payload.targetClientId,
              sentAt: new Date().toISOString()
            }
          });
          if (payload.targetClientId) {
            const target = clientsByClientId.get(payload.targetClientId);
            if (target) sendJson(target.socket, notice);
          } else {
            broadcastToPets(notice);
          }
        }
      } catch (error) {
        sendJson(socket, createErrorEnvelope(error.message));
      }
    });
    socket.on('close', () => admins.delete(socket));
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const wss = pathname === '/admin-ws' ? adminWss : pathname === '/ws' ? petWss : null;
    if (!wss) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });

  return {
    get url() {
      const address = httpServer.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      return `http://${host}:${actualPort}`;
    },
    start() {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject);
          resolve(this);
        });
      });
    },
    stop() {
      return new Promise(resolve => {
        petWss.clients.forEach(socket => socket.close());
        adminWss.clients.forEach(socket => socket.close());
        httpServer.close(() => resolve());
      });
    },
    clients: onlineClients
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { host: DEFAULT_HOST, port: DEFAULT_PORT };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[name] = argv[index + 1];
    index += 1;
  }
  if (options.port !== undefined) options.port = Number(options.port);
  if (options.maxClientsPerIp !== undefined) options.maxClientsPerIp = Number(options.maxClientsPerIp);
  if (options.maxMessagePerMinute !== undefined) options.maxMessagePerMinute = Number(options.maxMessagePerMinute);
  return options;
}

if (require.main === module) {
  const options = parseArgs();
  const service = createPetServer(options);
  service.start().then(() => {
    console.log(`Pet server listening: ${service.url}`);
    console.log(`Admin page: ${service.url}/admin`);
    console.log('Use wss:// behind Nginx/Caddy for public production deployment.');
  }).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  createPetServer,
  parseArgs
};
