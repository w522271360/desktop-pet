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
      <div>
        <span class="admin-kicker">Pet Network</span>
        <h1>桌宠服务管理</h1>
        <p>查看在线桌宠，并向全部或指定用户下发气泡消息。</p>
      </div>
      <div class="admin-summary" aria-label="服务概览">
        <div><strong id="summary-online">0</strong><span>在线</span></div>
        <div><strong id="summary-target">全部</strong><span>投放对象</span></div>
      </div>
    </section>
    <section class="admin-panel">
      <label>管理员 Token <input id="admin-token" type="password" autocomplete="current-password" placeholder="输入 admin token"></label>
      <button id="connect-admin">连接管理</button>
      <span id="admin-status" class="status-pill">未连接</span>
    </section>
    <section class="admin-grid">
      <div class="admin-card">
        <div class="card-heading">
          <h2>在线用户</h2>
          <span id="client-count">0 人</span>
        </div>
        <div id="clients"></div>
      </div>
      <div class="admin-card">
        <div class="card-heading">
          <h2>下发消息</h2>
          <span>气泡通知</span>
        </div>
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
  const summaryOnline = document.getElementById('summary-online');
  const summaryTarget = document.getElementById('summary-target');
  const clientCount = document.getElementById('client-count');
  let socket;
  function setStatus(text, state) {
    status.textContent = text;
    status.className = 'status-pill ' + (state || '');
  }
  function envelope(type, payload) {
    return JSON.stringify({ type, payload, requestId: String(Date.now()), sentAt: new Date().toISOString() });
  }
  function renderClients(clients) {
    clientsEl.innerHTML = '';
    target.innerHTML = '<option value="">全部用户</option>';
    summaryOnline.textContent = String(clients.length);
    clientCount.textContent = clients.length + ' 人';
    if (clients.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '暂无在线桌宠';
      clientsEl.appendChild(empty);
    }
    clients.forEach(client => {
      const item = document.createElement('div');
      item.className = 'client-card';
      const name = document.createElement('strong');
      name.textContent = client.nickname || '未命名桌宠';
      const meta = document.createElement('span');
      meta.textContent = client.shortId + ' · ' + (client.character || 'unknown') + ' · ' + (client.appVersion || 'unknown');
      const ip = document.createElement('small');
      ip.textContent = client.ip || 'unknown ip';
      item.append(name, meta, ip);
      clientsEl.appendChild(item);
      const option = document.createElement('option');
      option.value = client.clientId;
      option.textContent = client.nickname + ' (' + client.shortId + ')';
      target.appendChild(option);
    });
  }
  target.addEventListener('change', () => {
    summaryTarget.textContent = target.value ? '指定' : '全部';
  });
  connectBtn.addEventListener('click', () => {
    socket?.close();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(protocol + '//' + location.host + '/admin-ws');
    socket.addEventListener('open', () => {
      setStatus('认证中', 'pending');
      socket.send(envelope('admin.auth', { adminToken: tokenInput.value }));
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.type === 'admin.clients') {
        setStatus('已连接', 'ok');
        renderClients(message.payload.clients || []);
      }
      if (message.type === 'error') {
        setStatus(message.payload.message, 'error');
      }
    });
    socket.addEventListener('close', () => {
      setStatus('已断开', 'closed');
    });
  });
  send.addEventListener('click', () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!notice.value.trim()) return;
    socket.send(envelope('admin.notice', { text: notice.value, targetClientId: target.value || null }));
    notice.value = '';
  });
})();`;
}

function renderAdminCss() {
  return `:root{--bg:#f6f9fb;--surface:#fff;--surface-muted:#f2f6f7;--line:#dbe5e8;--line-strong:#c7d4d8;--text:#172126;--muted:#647278;--primary:#0f766e;--primary-dark:#115e59;--danger:#dc2626;--blue:#2563eb}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;background:linear-gradient(180deg,#f7fafc 0%,#eef4f6 100%);color:var(--text)}.admin-shell{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:28px 0 36px}.admin-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}.admin-kicker{display:inline-flex;margin-bottom:8px;border:1px solid #bfe7df;border-radius:999px;padding:4px 9px;background:#ecfdf5;color:var(--primary-dark);font-size:12px;font-weight:800}.admin-header h1{margin:0 0 8px;font-size:30px;letter-spacing:0}.admin-header p{margin:0;color:var(--muted)}.admin-summary{display:grid;grid-template-columns:repeat(2,minmax(92px,1fr));gap:10px}.admin-summary div,.admin-panel,.admin-card{border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.94);box-shadow:0 1px 2px rgba(20,32,38,.05)}.admin-summary div{padding:13px 14px}.admin-summary strong{display:block;font-size:24px}.admin-summary span{color:var(--muted);font-size:12px;font-weight:700}.admin-panel{display:grid;grid-template-columns:minmax(240px,1fr) auto auto;gap:12px;align-items:end;padding:16px;margin-bottom:16px}.admin-panel label{display:grid;gap:7px;color:var(--muted);font-size:13px;font-weight:700}.admin-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.8fr);gap:16px}.admin-card{padding:18px}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line)}.card-heading h2{margin:0;font-size:17px}.card-heading span{border-radius:999px;padding:5px 9px;background:var(--surface-muted);color:var(--muted);font-size:12px;font-weight:800}.admin-card>h2{display:none}.client-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:12px 0;border-bottom:1px solid var(--line)}.client-card:last-child{border-bottom:0}.client-card strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.client-card span{color:var(--muted);font-size:13px}.client-card small{grid-column:2;grid-row:1 / span 2;align-self:center;border-radius:999px;padding:5px 8px;background:var(--surface-muted);color:var(--muted)}.empty-state{border:1px dashed var(--line-strong);border-radius:8px;padding:28px;text-align:center;color:var(--muted);background:var(--surface-muted)}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;background:#fff;color:var(--text);font:inherit}input:focus,select:focus,textarea:focus{outline:0;border-color:var(--primary);box-shadow:0 0 0 3px rgba(15,118,110,.16)}textarea{min-height:160px;margin:12px 0;line-height:1.5;resize:vertical}button{border:1px solid var(--primary);border-radius:8px;background:var(--primary);color:white;padding:10px 14px;cursor:pointer;font:inherit;font-weight:800}button:hover{background:var(--primary-dark)}.status-pill{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--line);border-radius:999px;padding:0 12px;background:var(--surface-muted);color:var(--muted);font-size:13px;font-weight:800}.status-pill.ok{border-color:#bbf7d0;background:#f0fdf4;color:#15803d}.status-pill.pending{border-color:#bfdbfe;background:#eff6ff;color:var(--blue)}.status-pill.error{border-color:#fecaca;background:#fef2f2;color:var(--danger)}.status-pill.closed{border-color:var(--line);background:var(--surface-muted);color:var(--muted)}@media(max-width:760px){.admin-shell{width:min(100% - 20px,1120px);padding-top:16px}.admin-header{display:block}.admin-summary{margin-top:14px}.admin-panel,.admin-grid{grid-template-columns:1fr}.admin-panel{align-items:stretch}.client-card{grid-template-columns:1fr}.client-card small{grid-column:auto;grid-row:auto;justify-self:start}}`;
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
