// Подключаем коды ошибок
const errorCodes = require('./errorCodes');

// Функция для получения текста ошибки по коду
function getErrorText(code) {
  if (!code) return '';
  const n = Number(code);
  if (errorCodes.ERROR[n]) return errorCodes.ERROR[n];
  return '';
}

const fs = require('fs');
const path = require('path');

// --- Автоувеличение версии и логирование ---
const VERSION_FILE = path.join(__dirname, 'version.txt');
let version = 1;

try {
  if (fs.existsSync(VERSION_FILE)) {
    version = parseInt(fs.readFileSync(VERSION_FILE, 'utf-8').trim(), 10) || 1;
    version++;
  }
  fs.writeFileSync(VERSION_FILE, String(version), 'utf-8');
} catch (e) {
  console.log('[WARN] Не удалось обновить версию:', e.message);
}
console.log(`\n=== Rainbow SCADA Persistent Server v${version} ===`);
// solution_5_server/server.js

const WebSocket = require('ws');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');

const CONNECT_ENUM = {
  NO_CONNECTION: 'Нет соединения',
  CONNECTED: 'Соединен',
  ERROR: 'Ошибка',
  RECONNECTING: 'Реконнект',
  AUTHENTICATING: 'Авторизация',
  WAITING_CHALLENGE: 'Ожидание fedai',
  CONNECTING: 'Подключение'
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {
    return { ws_url: '', login: '', password: '', selected_device: '' };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify({ connect_state: state }, null, 2), 'utf-8');
  } catch (e) {
    console.log('[WARN] Не удалось сохранить state:', e.message);
  }
}

function calculateFedai(fedaiString) {
  const steps = fedaiString.split(';').map(s => s.trim()).filter(s => s && !s.includes('Bitti'));
  let result = 0;
  for (const step of steps) {
    const match = step.match(/([=+\-*/])=?\s*(\d+)/);
    if (match) {
      const operator = match[1];
      const value = parseInt(match[2]);
      switch(operator) {
        case '=': result = value; break;
        case '+': result += value; break;
        case '-': result -= value; break;
        case '*': result *= value; break;
        case '/': result = Math.floor(result / value); break;
      }
    }
  }
  return result;
}

/*class RainbowClient {
  constructor() {
    this.ws = null;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.messageQueue = [];
    this.fedaiChallenge = null;
    this.loginData = null;
    this.state = CONNECT_ENUM.NO_CONNECTION;
    this.config = loadConfig();
    this.isClosing = false;
  }

  setState(state) {
    this.state = state;
    saveState(state);
    console.log('[STATE]', state);
  }

  connect() {
    this.config = loadConfig();
    this.setState(CONNECT_ENUM.CONNECTING);
    this.ws = new WebSocket(this.config.ws_url, { rejectUnauthorized: false });

    this.ws.on('open', () => {
      this.setState(CONNECT_ENUM.WAITING_CHALLENGE);
      console.log('[WS][EVENT] open: соединение открыто, ждем fedai...');
      // Автоматический keepalive: ping + node_list/devx_list каждые 30 секунд
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping();
          console.log('[WS][PING] sent');
          // Отправляем node_list (или devx_list, если есть nodeId)
          try {
            // node_list
            this.send({ Request: 'node_list' });
            // devx_list для первого nodeId, если есть
            if (this.loginData && this.loginData.NodeList && Array.isArray(this.loginData.NodeList) && this.loginData.NodeList.length > 0) {
              const nodeId = this.loginData.NodeList[0].id;
              if (nodeId > 0) {
                this.send({ Request: 'devx_list', Node: nodeId, Skip: 0 });
              }
            }
          } catch (e) {
            console.log('[KEEPALIVE][ERROR]', e.message);
          }
        }
      }, 30000);
    });

    this.ws.on('message', (data) => {
      let msg = null;
      try {
        msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        // Если не JSON — бинарное сообщение
        let buf;
        if (Buffer.isBuffer(data)) buf = data;
        else if (typeof data === 'string') buf = Buffer.from(data, 'binary');
        else if (data instanceof ArrayBuffer) buf = Buffer.from(data);
        else buf = Buffer.from(data);
        this.handleMessage({ Binary: true, Data: buf.toString('base64') });
      }
    });

    this.ws.on('error', (err) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      this.setState(CONNECT_ENUM.ERROR);
      console.log('[WS][EVENT] error:', err);
      if (!this.isClosing) this.ws.close();
    });

    this.ws.on('close', (code, reason) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      if (this.isClosing) return;
      this.setState(CONNECT_ENUM.RECONNECTING);
      console.log('[WS][EVENT] close:', { code, reason });
      console.log('[WS] Соединение закрыто. Реконнект через 2 сек...');
      this.reconnectTimeout = setTimeout(() => this.connect(), 2000);
    });
  }

  handleMessage(msg) {
    try {
      if (typeof msg === 'object') {
        if (msg.Binary || msg.binary) {
          console.log('[SCADA][IN][BINARY]', JSON.stringify({ ...msg, Data: msg.Data ? `[base64:${msg.Data.length}]` : undefined, data: msg.data ? `[base64:${msg.data.length}]` : undefined }));
        } else {
          console.log('[SCADA][IN][JSON]', JSON.stringify(msg));
        }
      } else {
        console.log('[SCADA][IN][RAW]', msg);
      }
    } catch (e) {
      console.log('[SCADA][IN][ERR]', msg);
    }
    if (msg.Request === 'usr_fedai') this.fedaiChallenge = msg.fedai;
    if (msg.Request === 'usr_login') this.loginData = msg;
    this.messageQueue.push(msg);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async waitForMessage(requestType, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const msgs = this.messageQueue.filter(m => m.Request === requestType);
      if (msgs.length > 0) return msgs[msgs.length - 1];
      const warn = this.messageQueue.find(m => m.Request === 'user_warn');
      if (warn) throw new Error(warn.Text || warn.text || JSON.stringify(warn));
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Timeout waiting for ${requestType}`);
  }

  async login() {
    const { login, password } = this.config;
    await this.waitForMessage('usr_fedai', 10000);
    if (!this.fedaiChallenge) throw new Error('No fedai challenge received');
    const rndNum = calculateFedai(this.fedaiChallenge);
    const random = Date.now() * 10000;
    this.send({
      Request: 'usr_login',
      UsrNam: login,
      UsrPwd: password,
      ComIdt: -1,
      AppMod: 'V',
      Random: random,
      RndNum: rndNum
    });
    const loginResponse = await this.waitForMessage('usr_login', 20000);
    if (!loginResponse.UsrIdt) throw new Error('Login failed');
    this.setState(CONNECT_ENUM.CONNECTED);
    return loginResponse;
  }

  close() {
    this.isClosing = true;
    if (this.ws) this.ws.close();
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.setState(CONNECT_ENUM.NO_CONNECTION);
  }
}*/
class RainbowClient {
    constructor() {
        this.ws = null;
        this.config = loadConfig();
        this.messageQueue = [];
        this.fedaiChallenge = null;
        this.loginData = null;
        this.nodeList = null;
        this.deviceList = null;
        this.state = CONNECT_ENUM.NO_CONNECTION;
    }
    setState(state) {
      this.state = state;
      saveState(state);
      console.log('[STATE]', state);
    }
    connect() {
      // Не создавать новое соединение, если уже открыто
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return Promise.resolve();
      }
      this.setState(CONNECT_ENUM.CONNECTING);
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(this.config.ws_url, { rejectUnauthorized: false });
        this.ws.on('open', () => {
          this.setState(CONNECT_ENUM.WAITING_CHALLENGE);
          resolve();
        });
        this.ws.on('error', (err) => {
          this.setState(CONNECT_ENUM.ERROR);
          reject(err);
        });
        this.ws.on('close', () => {
          // При закрытии сбрасываем глобальный isLoggedIn
          isLoggedIn = false;
          this.setState(CONNECT_ENUM.RECONNECTING);
          this.login();
        });
        this.ws.on('message', (data) => {
          let msg = null;
          try {
            msg = JSON.parse(data.toString());
            this.handleMessage(msg);
          } catch (err) {
            // Если не JSON — бинарное сообщение
            let buf;
            if (Buffer.isBuffer(data)) buf = data;
            else if (typeof data === 'string') buf = Buffer.from(data, 'binary');
            else if (data instanceof ArrayBuffer) buf = Buffer.from(data);
            else buf = Buffer.from(data);
            this.handleMessage({ Binary: true, Data: buf.toString('base64') });
          }
        });
      });
    }
    handleMessage(msg) {
      // Логируем все входящие сообщения (и JSON, и бинарные)
      try {
        if (typeof msg === 'object') {
          if (msg.Binary || msg.binary) {
            console.log('[SCADA][IN][BINARY]', JSON.stringify({ ...msg, Data: msg.Data ? `[base64:${msg.Data.length}]` : undefined, data: msg.data ? `[base64:${msg.data.length}]` : undefined }));
          } else {
            console.log('[SCADA][IN][JSON]', JSON.stringify(msg));
          }
        } else {
          console.log('[SCADA][IN][RAW]', msg);
        }
      } catch (e) {
        console.log('[SCADA][IN][ERR]', msg);
      }
      // Обработка Multiple Logon Error
      if (msg.Request === 'user_warn' && (msg.ErrText === 'Multiple Logon Error' || msg.ErrCode === -1010)) {
        isLoggedIn = false;
        const errText = getErrorText(msg.ErrCode) || msg.ErrText;
        console.log(`[RECONNECT] Multiple Logon Error: инициируем реконнект... (${msg.ErrCode}: ${errText})`);
        this.close();
      }
      if (msg.Request === 'usr_fedai') this.fedaiChallenge = msg.fedai;
      if (msg.Request === 'usr_login') this.loginData = msg;
      if (msg.Request === 'node_list') this.nodeList = msg;
      if (msg.Request === 'devx_list') this.deviceList = msg;
      this.messageQueue.push(msg);
    }
    async waitForMessage(requestType, timeout = 5000) {
        const start = Date.now();
        let lastMsg = null;
        while (Date.now() - start < timeout) {
            const msgs = this.messageQueue.filter(m => m.Request === requestType);
            if (msgs.length > 0) return msgs[msgs.length - 1];
            const warn = this.messageQueue.find(m => m.Request === 'user_warn');
            if (warn) {
              const errText = getErrorText(warn.ErrCode) || warn.Text || warn.text || JSON.stringify(warn);
              throw new Error(errText);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error(`Timeout waiting for ${requestType}`);
    }
    async login() {
      const { login, password } = this.config;
      this.setState(CONNECT_ENUM.AUTHENTICATING);
      console.log('[LOGIN] Ожидание fedai challenge...');
      await this.waitForMessage('usr_fedai', 10000);
      if (!this.fedaiChallenge) throw new Error('No fedai challenge received');
      console.log('[LOGIN] Получен fedai:', this.fedaiChallenge);
      const rndNum = calculateFedai(this.fedaiChallenge);
      const random = Date.now() * 10000;
      const loginReq = {
        Request: 'usr_login',
        UsrNam: login,
        UsrPwd: password,
        ComIdt: -1,
        AppMod: 'V',
        Random: random,
        RndNum: rndNum
      };
      console.log('[LOGIN] Отправка запроса:', loginReq);
      this.send(loginReq);
      const loginResponse = await this.waitForMessage('usr_login', 20000);
      console.log('[LOGIN] Ответ:', loginResponse);
      if (!loginResponse.UsrIdt) throw new Error('Login failed');
      this.setState(CONNECT_ENUM.CONNECTED);
      const nodeList = await this.waitForMessage('node_list', 15000);
      console.log('[LOGIN] NodeList:', nodeList);
      return { login: loginResponse, nodes: nodeList };
    }
    send(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    }
    // (удалено дублирование)
    close() {
      if (this.ws) this.ws.close();
      this.setState(CONNECT_ENUM.NO_CONNECTION);
    }
}


const http = require('http');
const url = require('url');

// Глобальный persistent-клиент и очередь авторизации
const persistentClient = new RainbowClient();
let isLoggedIn = false;
let isConnecting = false;
let connectPromise = null;

async function ensureConnectedAndLoggedIn() {
  // Если уже есть соединение и логин — просто вернуть
  if (persistentClient.ws && persistentClient.ws.readyState === WebSocket.OPEN && isLoggedIn) {
    return;
  }
  // Если уже идёт процесс подключения/логина — ждем его
  if (isConnecting && connectPromise) {
    await connectPromise;
    return;
  }
  // Запускаем процесс подключения/логина
  isConnecting = true;
  connectPromise = (async () => {
    try {
      // Не создавать новое соединение, если уже открыто
      await persistentClient.connect();
      if (!isLoggedIn) {
        console.log('[LOGIN] Запуск авторизации...');
        await persistentClient.login();
        isLoggedIn = true;
        console.log('[LOGIN] Persistent авторизация успешна!');
      }
    } catch (e) {
      console.log('[LOGIN][ERROR]', e.message);
      isLoggedIn = false;
      // Если ошибка — закрыть соединение
      if (persistentClient.ws) try { persistentClient.ws.close(); } catch {}
    } finally {
      isConnecting = false;
      connectPromise = null;
    }
  })();
  await connectPromise;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (pathname === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  // Пример: /api/ping — отправить ping через persistent WS
  if (pathname === '/api/ping') {
    try {
      await ensureConnectedAndLoggedIn();
      persistentClient.ws.ping();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: 'Ping sent' }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Пример: /api/node_list — получить node_list через persistent WS
  if (pathname === '/api/node_list') {
    try {
      await ensureConnectedAndLoggedIn();
      persistentClient.send({ Request: 'node_list' });
      const nodeList = await persistentClient.waitForMessage('node_list', 10000);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: nodeList }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Пример: /api/devx_list?node=10324 — получить devx_list
  if (pathname === '/api/devx_list') {
    try {
      await ensureConnectedAndLoggedIn();
      const nodeId = Number(parsedUrl.query.node) || 0;
      if (!nodeId) throw new Error('No node id');
      persistentClient.send({ Request: 'devx_list', Node: nodeId, Skip: 0 });
      const devxList = await persistentClient.waitForMessage('devx_list', 10000);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: devxList }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Пример: /api/any — универсальный прокси для SCADA-запросов (POST)
  if (pathname === '/api/any' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        await ensureConnectedAndLoggedIn();
        const data = JSON.parse(body);
        persistentClient.send(data);
        const resp = await persistentClient.waitForMessage(data.Request, 10000);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: resp }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 8765;
server.listen(PORT, () => {
  console.log(`\n=== Rainbow SCADA Persistent HTTP+WS Server ===`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Persistent WebSocket: ${persistentClient.config.ws_url}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/ping`);
  console.log(`  GET  /api/node_list`);
  console.log(`  GET  /api/devx_list?node=ID`);
  console.log(`  POST /api/any  (body=Request)`);
  console.log(`\nPress Ctrl+C to stop\n`);
  // Автоматический логин при старте
  ensureConnectedAndLoggedIn().catch(e => {
    console.log('[AUTOLOGIN][ERROR]', e.message);
  });
});
