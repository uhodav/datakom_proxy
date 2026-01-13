const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(__dirname, 'log.txt');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;

// Logger with rotation
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [${level}] ${args.join(' ')}`;
  
  // Console output
  console.log(message);
  
  // File output with rotation
  try {
    // Check if log file needs rotation
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size >= MAX_LOG_SIZE) {
        rotateLog();
      }
    } else {
      // Create log file if it doesn't exist
      fs.writeFileSync(LOG_FILE, '', 'utf-8');
    }
    
    fs.appendFileSync(LOG_FILE, message + '\n', 'utf-8');
  } catch (e) {
    console.error('[LOG][ERROR]', e.message);
  }
}

function rotateLog() {
  try {
    // Remove oldest log if exists
    const oldestLog = LOG_FILE.replace('.txt', `.${MAX_LOG_FILES}.txt`);
    if (fs.existsSync(oldestLog)) {
      fs.unlinkSync(oldestLog);
    }
    
    // Rotate existing logs
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const currentLog = LOG_FILE.replace('.txt', `.${i}.txt`);
      const nextLog = LOG_FILE.replace('.txt', `.${i + 1}.txt`);
      if (fs.existsSync(currentLog)) {
        fs.renameSync(currentLog, nextLog);
      }
    }
    
    // Rename current log to .1.txt
    fs.renameSync(LOG_FILE, LOG_FILE.replace('.txt', '.1.txt'));
    log('INFO', 'Log rotated successfully');
  } catch (e) {
    console.error('[LOG][ROTATE][ERROR]', e.message);
  }
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  log('INFO', 'Created data directory:', DATA_DIR);
}

function getIntFromQueryOrConfig(query, key, configKey) {
  let val = query[key];
  if (typeof val === 'string') {
    const match = val.match(/\d+/);
    if (match) val = Number(match[0]);
    else val = undefined;
  }
  if (typeof val === 'number' && isNaN(val)) val = undefined;
  if (!val) {
    try {
      const config = loadConfig();
      val = config[configKey];
    } catch {}
  }
  return val;
}

// Forming the dump_devm filename
function getDumpDevmFileName(node_id, did) {
  if (!node_id || !did) {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
      if (!node_id) node_id = config.node_id;
      if (!did) did = config.did;
    } catch {}
  }
  return `dump_devm_${node_id}_${did}.json`;
}
// For saving binary packets
function saveBinaryPacket(data) {
  try {
    const now = new Date();
    const fname = `binary.bin`;
    const fpath = path.join(__dirname, fname);
    fs.writeFileSync(fpath, Buffer.from(data, 'base64'));
    log('INFO', 'Binary packet saved to', fname);
  } catch (e) {
    log('ERROR', 'Failed to save binary packet:', e.message);
  }
}
// Import error codes
// const errorCodes = require(path.join(DATA_DIR, 'errorCodes.js'));

// Function to get error text by code
function getErrorText(code) {
  // if (!code) return '';
  // const n = Number(code);
  // if (errorCodes.ERROR[n]) return errorCodes.ERROR[n];
  // return '';
  return '';
}


const VERSION_FILE = path.join(DATA_DIR, 'version.txt');
let version = 1;

try {
  if (fs.existsSync(VERSION_FILE)) {
    version = parseInt(fs.readFileSync(VERSION_FILE, 'utf-8').trim(), 10) || 1;
    version++;
  }
  fs.writeFileSync(VERSION_FILE, String(version), 'utf-8');
  log('INFO', 'Server version:', version);
} catch (e) {
  log('WARN', 'Could not update the version:', e.message);
}
// solution_5_server/server.js

const WebSocket = require('ws');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(DATA_DIR, 'state.json');

const CONNECT_ENUM = {
NO_CONNECTION: 'No connection',
CONNECTED: 'Connected',
ERROR: 'Error',
RECONNECTING: 'Reconnect',
AUTHENTICATING: 'Authorization',
WAITING_CHALLENGE: 'Waiting for fedai',
CONNECTING: 'Connecting',
PAUSED: 'Paused',
WAITING: 'Waiting'
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {
    return { ws_url: '', login: '', password: '', node_id: '', did: '' };
  }
}

function saveState(state) {
  try {
    const stateData = {
      connect_state: state,
      date_time_change_state: new Date().toISOString()
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(stateData, null, 2), 'utf-8');
  } catch (e) {
    log('WARN', 'Could not save state:', e.message);
  }
}

function saveConnectionError(error) {
  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      code: error.code || null,
      stack: error.stack || null
    };
    const errorPath = path.join(DATA_DIR, 'connected_error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorData, null, 2), 'utf-8');
  } catch (e) {
    log('WARN', 'Could not save connection error:', e.message);
  }
}

function clearConnectionError() {
  try {
    const errorPath = path.join(DATA_DIR, 'connected_error.json');
    if (fs.existsSync(errorPath)) {
      fs.unlinkSync(errorPath);
      log('INFO', 'Cleared previous connection error');
    }
  } catch (e) {
    log('WARN', 'Could not clear connection error:', e.message);
  }
}

function getStateData() {
  try {
    const stateData = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(stateData);
  } catch (e) {
    return { connect_state: CONNECT_ENUM.NO_CONNECTION, date_time_change_state: null };
  }
}

function shouldDisconnectForMaintenance() {
  try {
    const stateData = getStateData();
    if (stateData.connect_state !== CONNECT_ENUM.CONNECTED) return false;
    if (!stateData.date_time_change_state) return false;
    
    const lastChange = new Date(stateData.date_time_change_state);
    const now = new Date();
    const minutesPassed = (now - lastChange) / (1000 * 60);
    
    // If 50 minutes passed since connection - disconnect
    if (minutesPassed >= 50) {
      log('INFO', '50 minutes passed, disconnecting for 10 minutes maintenance');
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function canReconnectAfterMaintenance() {
  try {
    const stateData = getStateData();
    if (stateData.connect_state !== CONNECT_ENUM.WAITING) return true;
    if (!stateData.date_time_change_state) return true;
    
    const lastChange = new Date(stateData.date_time_change_state);
    const now = new Date();
    const minutesPassed = (now - lastChange) / (1000 * 60);
    
    // If 10 minutes passed since disconnect - can reconnect
    if (minutesPassed >= 10) {
      log('INFO', '10 minutes passed, can reconnect');
      return true;
    }
    
    const remainingMinutes = Math.ceil(10 - minutesPassed);
    log('INFO', `Still waiting ${remainingMinutes} minutes before reconnect`);
    return false;
  } catch (e) {
    return true;
  }
}

function canAttemptReconnect(forceLog = false) {
  try {
    const stateData = getStateData();
    const config = loadConfig();
    
    // If state is PAUSED and date_time_change_state exists
    if (stateData.connect_state === CONNECT_ENUM.PAUSED && stateData.date_time_change_state) {
      const waitMinutes = config.reconnect_wait_minutes || 60;
      const lastAttempt = new Date(stateData.date_time_change_state);
      const now = new Date();
      const minutesPassed = (now - lastAttempt) / (1000 * 60);
      
      if (minutesPassed >= waitMinutes) {
        log('INFO', `Wait time ${waitMinutes} minutes passed, attempting reconnect`);
        return true;
      }
      
      const remainingMinutes = Math.ceil(waitMinutes - minutesPassed);
      // Log only once every 5 minutes to avoid spam
      const nowTime = Date.now();
      if (forceLog || nowTime - lastReconnectLogTime > RECONNECT_LOG_INTERVAL) {
        log('INFO', `Still waiting ${remainingMinutes} of ${waitMinutes} minutes before next attempt`);
        lastReconnectLogTime = nowTime;
      }
      return false;
    }
    
    return true;
  } catch (e) {
    return true;
  }
}

function handleConnectionFailure() {
  try {
    const config = loadConfig();
    const currentWait = config.reconnect_wait_minutes || 60;
    const newWait = currentWait + 10;
    
    config.reconnect_wait_minutes = newWait;
    
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    log('INFO', `Connection failed. Next wait time: ${newWait} minutes`);
  } catch (e) {
    log('WARN', 'Could not update reconnect config:', e.message);
  }
}

function resetReconnectConfig(force = false) {
  try {
    const config = loadConfig();
    const oldWait = config.reconnect_wait_minutes || 60;
    config.reconnect_wait_minutes = 60;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    if (force) {
      log('INFO', `Manual restart - wait time reset from ${oldWait} to 60 minutes`);
    } else {
      log('INFO', `Connection stable for 30 minutes, reset wait time from ${oldWait} to 60 minutes`);
    }
  } catch (e) {
    log('WARN', 'Could not reset reconnect config:', e.message);
  }
}

// Функция для запуска проверки стабильности соединения
function startStableConnectionCheck() {
  // Очищаем предыдущий интервал, если есть
  if (stableConnectionCheckInterval) {
    clearInterval(stableConnectionCheckInterval);
  }
  
  lastSuccessfulConnectionTime = Date.now();
  
  // Проверяем каждую минуту
  stableConnectionCheckInterval = setInterval(() => {
    if (!isLoggedIn || !persistentClient.ws || persistentClient.ws.readyState !== WebSocket.OPEN) {
      // Соединение потеряно, останавливаем проверку
      clearInterval(stableConnectionCheckInterval);
      stableConnectionCheckInterval = null;
      lastSuccessfulConnectionTime = null;
      return;
    }
    
    const config = loadConfig();
    const currentWait = config.reconnect_wait_minutes || 60;
    
    // Если соединение стабильно и время ожидания больше 60 минут
    if (currentWait > 60 && lastSuccessfulConnectionTime) {
      const minutesPassed = (Date.now() - lastSuccessfulConnectionTime) / (1000 * 60);
      
      if (minutesPassed >= 30) {
        // Соединение стабильно 30 минут, сбрасываем время ожидания
        resetReconnectConfig();
        clearInterval(stableConnectionCheckInterval);
        stableConnectionCheckInterval = null;
        lastSuccessfulConnectionTime = null;
      }
    } else if (currentWait <= 60) {
      // Время ожидания уже минимальное, останавливаем проверку
      clearInterval(stableConnectionCheckInterval);
      stableConnectionCheckInterval = null;
      lastSuccessfulConnectionTime = null;
    }
  }, 60000); // Проверяем каждую минуту
}

async function tryConnectIfReady() {
  // If already connected - return true immediately
  if (persistentClient.ws && persistentClient.ws.readyState === WebSocket.OPEN && isLoggedIn) {
    return true;
  }
  
  // Log current state only once every 5 minutes during pause
  const nowTime = Date.now();
  const shouldLog = nowTime - lastReconnectLogTime > RECONNECT_LOG_INTERVAL;
  
  if (shouldLog) {
    log('INFO', `Current connection state: ${persistentClient.state}`);
  }
  
  // If WAITING mode - check if we can reconnect
  if (persistentClient.state === CONNECT_ENUM.WAITING) {
    if (canReconnectAfterMaintenance()) {
      log('INFO', 'Maintenance period expired, attempting to reconnect...');
      try {
        await ensureConnectedAndLoggedIn();
        return true;
      } catch (e) {
        log('ERROR', 'Reconnect after maintenance failed:', e.message);
        return false;
      }
    } else {
      if (shouldLog) {
        log('INFO', 'Service is in maintenance mode, serving data from files');
      }
      return false;
    }
  }
  
  if (persistentClient.state === CONNECT_ENUM.PAUSED) {
    if (canAttemptReconnect(shouldLog)) {
      log('INFO', 'Pause expired, attempting to reconnect...');
      try {
        await ensureConnectedAndLoggedIn();
        return true;
      } catch (e) {
        log('ERROR', 'Reconnect failed:', e.message);
        return false;
      }
    } else {
      if (shouldLog) {
        log('INFO', 'Service is paused, serving data from files');
      }
      return false;
    }
  }
  
  // If not connected and not paused - try to connect
  if (canAttemptReconnect()) {
    try {
      await ensureConnectedAndLoggedIn();
      return true;
    } catch (e) {
      return false;
    }
  }
  
  return false;
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

    saveDumpDevm(msg) {
      try {
        // Determine did and node_id for filename
        const did = msg.did || (this.config && this.config.did);
        let node_id = null;
        if (Array.isArray(msg.node_id) && msg.node_id.length > 0) node_id = msg.node_id[0];
        else if (typeof msg.node_id === 'number') node_id = msg.node_id;
        else node_id = (this.config && this.config.node_id) || 'unknown';
        log('DEBUG', 'Saving dump_devm for node_id:', node_id, 'did:', did);
        const fname = getDumpDevmFileName(node_id, did);
        fs.writeFileSync(path.join(DATA_DIR, fname), JSON.stringify(msg, null, 2), 'utf-8');
      } catch (e) {
        log('ERROR', 'Failed to save dump_devm:', e.message);
      }
    }

    setState(state) {
      this.state = state;
      saveState(this.state);
    }
    connect() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return Promise.resolve();
      }
      this.setState(CONNECT_ENUM.CONNECTING);
      clearConnectionError();
      log('INFO', 'Connecting to:', this.config.ws_url);
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(this.config.ws_url, { rejectUnauthorized: false });
        
        this.ws.on('unexpected-response', (request, response) => {
          log('WARN', 'Unexpected response - Status:', response.statusCode, response.statusMessage);
          let body = '';
          response.on('data', chunk => body += chunk.toString());
          response.on('end', () => log('WARN', 'Unexpected response body:', body));
        });
        
        this.ws.on('open', () => {
          log('INFO', 'WebSocket connection established');
          this.setState(CONNECT_ENUM.WAITING_CHALLENGE);
          resolve();
        });
        this.ws.on('error', (err) => {
          log('ERROR', 'WebSocket error:', err.message);
          // Останавливаем проверку стабильности соединения
          if (stableConnectionCheckInterval) {
            clearInterval(stableConnectionCheckInterval);
            stableConnectionCheckInterval = null;
            lastSuccessfulConnectionTime = null;
          }
          this.setState(CONNECT_ENUM.PAUSED);
          saveConnectionError(err);
          handleConnectionFailure();
          reject(err);
        });
        this.ws.on('close', (code, reason) => {
          isLoggedIn = false;
          // Останавливаем проверку стабильности соединения
          if (stableConnectionCheckInterval) {
            clearInterval(stableConnectionCheckInterval);
            stableConnectionCheckInterval = null;
            lastSuccessfulConnectionTime = null;
          }
          // If code 1006 or 1002 - it's abnormal close, set pause
          if (code === 1006 || code === 1002) {
            this.setState(CONNECT_ENUM.PAUSED);
            handleConnectionFailure();
          } else {
            this.setState(CONNECT_ENUM.NO_CONNECTION);
          }
          const closeError = new Error(`WebSocket closed: code=${code}, reason=${reason}`);
          closeError.code = code;
          saveConnectionError(closeError);
          log('WARN', 'WebSocket closed - code:', code, 'reason:', reason || 'none');
        });
        this.ws.on('message', (data) => {
          let msg = null;
          try {
            msg = JSON.parse(data.toString());
            this.handleMessage(msg);
          } catch (err) {
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
      const msgPreview = JSON.stringify(msg).substring(0, 200);
      log('DEBUG', 'Received message:', msgPreview);
      if (msg.Request === 'dump_devm' && msg.MSG) {
        this.saveDumpDevm(msg.MSG);
      } else if (msg.Binary && msg.Data) {
        saveBinaryPacket(msg.Data);
      }
      if (msg.Request === 'user_warn' && (msg.ErrText === 'Multiple Logon Error' || msg.ErrCode === -1010)) {
        isLoggedIn = false;
        const errText = getErrorText(msg.ErrCode) || msg.ErrText;
        log('WARN', `Multiple Logon Error detected (${msg.ErrCode}: ${errText})`);
        log('WARN', 'Another session is active. Waiting 30 seconds before closing connection...');
        // Останавливаем проверку стабильности
        if (stableConnectionCheckInterval) {
          clearInterval(stableConnectionCheckInterval);
          stableConnectionCheckInterval = null;
          lastSuccessfulConnectionTime = null;
        }
        // Ждем 30 секунд перед закрытием, чтобы другая сессия успела завершиться
        setTimeout(() => {
          log('INFO', 'Closing connection after Multiple Logon Error delay');
          this.close();
        }, 30000);
      }
      if (msg.Request === 'usr_fedai') {
        this.fedaiChallenge = msg.fedai;
        log('DEBUG', 'Received fedai challenge:', msg.fedai.substring(0, 100) + '...');
      }
      if (msg.Request === 'usr_login') this.loginData = msg;
      if (msg.Request === 'node_list') {
        this.nodeList = msg;
        // Save first node_id to config.json
        if (msg.NodeList && Array.isArray(msg.NodeList) && msg.NodeList.length > 0) {
          const node_id = msg.NodeList[0].id;
          let config = loadConfig();
          config.node_id = node_id;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
          // Reload config after update
          this.config = loadConfig();
        }
      }

      if (msg.Request === 'devx_list') {
        this.deviceList = msg;
        // Save devx_list to a file by nodeId
        if (msg.Node || (msg.DevxList && msg.DevxList.length > 0 && msg.DevxList[0].Node)) {
          const nodeId = msg.Node || msg.DevxList[0].Node;
          try {
            fs.writeFileSync(path.join(DATA_DIR, `devx_list_${nodeId}.json`), JSON.stringify(msg, null, 2), 'utf-8');
          } catch (e) {
            log('ERROR', 'Could not save devx_list:', e.message);
          }
        }
        // Reload config in case did was updated elsewhere
        this.config = loadConfig();
      }

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
      log('DEBUG', 'Starting login process for user:', login);
      this.setState(CONNECT_ENUM.AUTHENTICATING);
      
      log('DEBUG', 'Waiting for usr_fedai challenge...');
      await this.waitForMessage('usr_fedai', 10000);
      
      if (!this.fedaiChallenge) {
        log('ERROR', 'No fedai challenge received');
        throw new Error('No fedai challenge received');
      }
      
      log('DEBUG', 'Received fedai challenge, calculating response...');
      const rndNum = calculateFedai(this.fedaiChallenge);
      const random = Date.now() * 10000;
      
      const loginReq = {
        Request: 'usr_login',
        UsrNam: login,
        UsrPwd: password,
        ComIdt: -1,
        AppMod: 'V',
        MsgPrm: 'JSON',
        Random: random,
        RndNum: rndNum
      };
      
      log('DEBUG', 'Sending usr_login request with fedai response...');
      this.send(loginReq);
      
      log('DEBUG', 'Waiting for usr_login response...');
      const loginResponse = await this.waitForMessage('usr_login', 20000);
      
      if (!loginResponse.UsrIdt) {
        log('ERROR', 'Login failed - no UsrIdt in response:', JSON.stringify(loginResponse));
        throw new Error('Login failed');
      }
      
      log('INFO', 'Login successful, UsrIdt:', loginResponse.UsrIdt);
      this.setState(CONNECT_ENUM.CONNECTED);
      this.send({ Request: 'node_list' });
      const nodeList = await this.waitForMessage('node_list', 15000);
      try {
        fs.writeFileSync(path.join(DATA_DIR, 'node_list.json'), JSON.stringify(nodeList, null, 2), 'utf-8');
        const CONFIG_PATH = path.join(__dirname, 'config.json');
        const STATE_PATH = path.join(DATA_DIR, 'state.json');
        fs.writeFileSync(STATE_PATH, JSON.stringify({ connect_state: this.state }, null, 2), 'utf-8');
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } catch (e) {
        log('ERROR', 'Could not save node_list:', e.message);
      }
      // Auto-send devx_list and devx_pump for the first node
      if (nodeList && nodeList.NodeList && nodeList.NodeList.length > 0) {
        const nodeId = nodeList.NodeList[0].id;
        this.send({ Request: 'devx_list', Node: nodeId, Skip: 0 });
        // Wait for devx_list for this node
        const devxList = await this.waitForMessage('devx_list', 10000);
        if (devxList && devxList.DevxList && devxList.DevxList.length > 0) {
          const did = devxList.DevxList[0].did;
          this.send({ Request: 'devx_pump', job: 1, did });
        } else {
          log('WARN', 'No devices for devx_pump');
        }
      }
      return { login: loginResponse, nodes: nodeList };
    }
    send(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    }

    close() {
      if (this.ws) this.ws.close();
      this.setState(CONNECT_ENUM.NO_CONNECTION);
    }
    
    disconnectForMaintenance() {
      log('INFO', 'Disconnecting for 10 minutes maintenance...');
      isLoggedIn = false;
      if (this.ws) {
        try {
          this.ws.close();
        } catch (e) {
          log('WARN', 'Error closing WebSocket:', e.message);
        }
      }
      this.setState(CONNECT_ENUM.WAITING);
    }
}


const http = require('http');
const url = require('url');

const persistentClient = new RainbowClient();
let isLoggedIn = false;
let isConnecting = false;
let connectPromise = null;
let lastSuccessfulConnectionTime = null; // Время последнего успешного подключения
let stableConnectionCheckInterval = null; // Интервал для проверки стабильности соединения
let lastReconnectLogTime = 0;
const RECONNECT_LOG_INTERVAL = 5 * 60 * 1000; // Log once every 5 minutes

async function ensureConnectedAndLoggedIn() {
  if (persistentClient.ws && persistentClient.ws.readyState === WebSocket.OPEN && isLoggedIn) {
    return;
  }
  
  // Check if in WAITING mode
  if (persistentClient.state === CONNECT_ENUM.WAITING) {
    if (!canReconnectAfterMaintenance()) {
      throw new Error('Connection is in maintenance mode. Waiting before reconnect.');
    }
  }
  
  // Check if we can attempt to reconnect
  if (!canAttemptReconnect()) {
    persistentClient.setState(CONNECT_ENUM.PAUSED);
    throw new Error('Connection is paused. Waiting before next reconnect attempt.');
  }
  
  if (isConnecting && connectPromise) {
    await connectPromise;
    return;
  }
  isConnecting = true;
  connectPromise = (async () => {
    try {
      await persistentClient.connect();
      if (!isLoggedIn) {
        await persistentClient.login();
        isLoggedIn = true;
        const config = loadConfig();
        const currentWait = config.reconnect_wait_minutes || 60;
        log('INFO', `Connection successful (current wait time: ${currentWait} minutes). Will reset to 60 minutes after 30 minutes of stable connection`);
        startStableConnectionCheck();
      }
      
      let config = loadConfig();
      if (!config.did) {
        
        persistentClient.send({ Request: 'node_list' });
        const nodeList = await persistentClient.waitForMessage('node_list', 10000);
        let nodeId = 0;
        if (nodeList && nodeList.NodeList && nodeList.NodeList.length > 0) {
          nodeId = nodeList.NodeList[0].id;
        }
        if (nodeId) {
          persistentClient.send({ Request: 'devx_list', Node: nodeId, Skip: 0 });
          const devxList = await persistentClient.waitForMessage('devx_list', 10000);
          if (devxList && devxList.DevxList && devxList.DevxList.length > 0) {
            const did = devxList.DevxList[0].did;
            config.did = did;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
          }
        }
      }
    } catch (e) {
      log('ERROR', 'Login failed:', e.message);
      // Останавливаем проверку стабильности соединения
      if (stableConnectionCheckInterval) {
        clearInterval(stableConnectionCheckInterval);
        stableConnectionCheckInterval = null;
        lastSuccessfulConnectionTime = null;
      }
      saveConnectionError(e);
      handleConnectionFailure();
      persistentClient.setState(CONNECT_ENUM.PAUSED);
      isLoggedIn = false;
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

  // Serving api_test.html
  if (pathname === '/api_test.html') {
    const htmlPath = path.join(__dirname, 'api_test.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (pathname === '/api/health') {
    let connect_state = null;
    let last_error = null;
    let date_time_change_state = null;
    let reconnect_wait_minutes = null;
    let next_reconnect_time = null;
    
    try {
      const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
      const stateObj = JSON.parse(stateData);
      connect_state = stateObj.connect_state || null;
      date_time_change_state = stateObj.date_time_change_state || null;
      
      // Calculate next reconnect time if in Paused or Waiting state
      if (date_time_change_state) {
        const config = loadConfig();
        reconnect_wait_minutes = config.reconnect_wait_minutes || null;
        
        if (connect_state === 'Paused' && reconnect_wait_minutes) {
          const lastChange = new Date(date_time_change_state);
          const nextReconnect = new Date(lastChange.getTime() + reconnect_wait_minutes * 60 * 1000);
          next_reconnect_time = nextReconnect.toISOString();
        } else if (connect_state === 'Waiting') {
          const lastChange = new Date(date_time_change_state);
          const nextReconnect = new Date(lastChange.getTime() + 10 * 60 * 1000);
          next_reconnect_time = nextReconnect.toISOString();
        }
      }
    } catch {}
    try {
      const errorData = fs.readFileSync(path.join(DATA_DIR, 'connected_error.json'), 'utf-8');
      last_error = JSON.parse(errorData);
    } catch {}
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      time: new Date().toISOString(),
      connect_state,
      date_time_change_state,
      reconnect_wait_minutes,
      next_reconnect_time,
      last_error
    }));
    return;
  }

  // /api/dump_devm_param_names — list of all ids and labels from VALUE
  if (pathname === '/api/dump_devm_param_names') {
    try {
      const node_id = getIntFromQueryOrConfig(parsedUrl.query, 'node_id', 'node_id');
      const did = getIntFromQueryOrConfig(parsedUrl.query, 'did', 'did');
      const dumpFile = getDumpDevmFileName(node_id, did);
      const dumpPath = path.join(DATA_DIR, dumpFile);
      
      const isConnected = await tryConnectIfReady();
      
      if (isConnected && !fs.existsSync(dumpPath)) {
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
        }
      }
      
      // Try to read from file
      if (fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        let params = [];
        if (data && data.VALUE && Array.isArray(data.VALUE)) {
          params = data.VALUE.filter(item => item.A !== undefined && item.N).map(item => ({ id: item.A, label: item.N }));
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, params, cached: !isConnected }));
        return;
      }
      
      // If file doesn't exist - return null
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, params: null, cached: true }));
      return;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // get EXTRA.Alarm
  if (pathname === '/api/dump_devm_alarm') {
    try {
      const node_id = getIntFromQueryOrConfig(parsedUrl.query, 'node_id', 'node_id');
      const did = getIntFromQueryOrConfig(parsedUrl.query, 'did', 'did');
      const dumpFile = `dump_devm_${node_id}_${did}.json`;
      const dumpPath = path.join(DATA_DIR, dumpFile);
      
      const isConnected = await tryConnectIfReady();
      
      if (isConnected && !fs.existsSync(dumpPath)) {
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
        }
      }
      
      // Try to read from file
      if (fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        const alarm = data && data.EXTRA && data.EXTRA.Alarm ? data.EXTRA.Alarm : null;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, alarm, cached: !isConnected }));
        return;
      }
      
      // If file doesn't exist - return null
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, alarm: null, cached: true }));
      return;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // /api/dump_devm_leds — get EXTRA.Leds
  if (pathname === '/api/dump_devm_leds') {
    try {
      const node_id = getIntFromQueryOrConfig(parsedUrl.query, 'node_id', 'node_id');
      const did = getIntFromQueryOrConfig(parsedUrl.query, 'did', 'did');
      const dumpFile = `dump_devm_${node_id}_${did}.json`;
      const dumpPath = path.join(DATA_DIR, dumpFile);
      
      const isConnected = await tryConnectIfReady();
      
      if (isConnected && !fs.existsSync(dumpPath)) {
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
        }
      }
      
      // Try to read from file
      if (fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        const leds = data && data.EXTRA && data.EXTRA.Leds ? data.EXTRA.Leds : null;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, leds, cached: !isConnected }));
        return;
      }
      
      // If file doesn't exist - return null
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, leds: null, cached: true }));
      return;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // /api/dump_devm_dout — get EXTRA.Dout (digital outputs)
  if (pathname === '/api/dump_devm_dout') {
    try {
      const node_id = getIntFromQueryOrConfig(parsedUrl.query, 'node_id', 'node_id');
      const did = getIntFromQueryOrConfig(parsedUrl.query, 'did', 'did');
      const dumpFile = `dump_devm_${node_id}_${did}.json`;
      const dumpPath = path.join(DATA_DIR, dumpFile);
      
      const isConnected = await tryConnectIfReady();
      
      if (isConnected && !fs.existsSync(dumpPath)) {
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
        }
      }
      
      // Try to read from file
      if (fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        const dout = data && data.EXTRA && data.EXTRA.Dout ? data.EXTRA.Dout : null;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, dout, cached: !isConnected }));
        return;
      }
      
      // If file doesn't exist - return null
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, dout: null, cached: true }));
      return;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Example: /api/node_list — get node_list via persistent WS
  if (pathname === '/api/node_list') {
    const nodeListPath = path.join(DATA_DIR, 'node_list.json');
    try {
      const isConnected = await tryConnectIfReady();
      
      if (isConnected) {
        persistentClient.send({ Request: 'node_list' });
        const nodeList = await persistentClient.waitForMessage('node_list', 10000);
        fs.writeFileSync(nodeListPath, JSON.stringify(nodeList, null, 2), 'utf-8');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: nodeList }));
        return;
      }
      
      // If not connected - try to return data from file
      if (fs.existsSync(nodeListPath)) {
        const nodeList = JSON.parse(fs.readFileSync(nodeListPath, 'utf-8'));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: nodeList, cached: true }));
        return;
      }
      
      // If file doesn't exist - return null
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: null, cached: true }));
      return;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }

  // Example: /api/devx_list?node_id=12345 — get devx_list
  if (pathname === '/api/devx_list') {
    const nodeId = getIntFromQueryOrConfig(parsedUrl.query, 'node_id', 'node_id');
    if (!nodeId) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'No node id' }));
      return;
    }
    const devxListPath = path.join(DATA_DIR, `devx_list_${nodeId}.json`);
    try {
      const isConnected = await tryConnectIfReady();
      
      if (isConnected) {
        persistentClient.send({ Request: 'devx_list', Node: nodeId, Skip: 0 });
        const devxList = await persistentClient.waitForMessage('devx_list', 10000);
        fs.writeFileSync(devxListPath, JSON.stringify(devxList, null, 2), 'utf-8');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: devxList }));
        return;
      }
      
      // If not connected - try to return data from file
      if (fs.existsSync(devxListPath)) {
        const devxList = JSON.parse(fs.readFileSync(devxListPath, 'utf-8'));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: devxList, cached: true }));
        return;
      }
      
      // If file doesn't exist - return null
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: null, cached: true }));
      return;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }

  // /api/dump_devm
  // ?id=293,274 or without id — all parameters
  if (pathname === '/api/dump_devm') {
    try {
      const node_id = getIntFromQueryOrConfig(parsedUrl.query, 'node_id', 'node_id');
      const did = getIntFromQueryOrConfig(parsedUrl.query, 'did', 'did');
      const dumpFile = `dump_devm_${node_id}_${did}.json`;
      const dumpPath = path.join(DATA_DIR, dumpFile);
      
      const isConnected = await tryConnectIfReady();
      
      if (isConnected && !fs.existsSync(dumpPath)) {
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
        }
      }
      
      let data = null;
      if (fs.existsSync(dumpPath)) {
        data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
      }
      
      if (!data) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, result: null, cached: true }));
        return;
      }
      
      let ids = [];
      if (parsedUrl.query.id) {
        if (Array.isArray(parsedUrl.query.id)) {
          ids = parsedUrl.query.id.flatMap(s => s.split(',').map(Number));
        } else {
          ids = String(parsedUrl.query.id).split(',').map(Number);
        }
      }
      let result = [];
      if (data && data.VALUE && Array.isArray(data.VALUE)) {
        let filtered = data.VALUE.filter(item => item.A !== undefined && item.N);
        if (ids.length > 0) {
          filtered = filtered.filter(item => ids.includes(Number(item.A)));
        }
        result = filtered.map(item => ({
          id: item.A,
          label: item.N,
          value: item.V,
          unit: item.U
        }));
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, result, cached: !isConnected }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }
  // /api/restart — restart service (close WS and reconnect)
  if (pathname === '/api/restart') {
    try {
      isLoggedIn = false;
      if (persistentClient.ws) {
        persistentClient.close();
      }
      // Reset pause and wait settings
      resetReconnectConfig(true);
      // Wait a bit before reconnecting
      setTimeout(async () => {
        try {
          await ensureConnectedAndLoggedIn();
        } catch (e) {
          log('ERROR', 'Restart failed:', e.message);
        }
      }, 1000);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: 'Service restart initiated' }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // POST /api/device/control — Device Control commands (Run, Auto, Manual, Test, Stop)
  if (pathname === '/api/device/control' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        let { did, action, node_id } = JSON.parse(body);
        
        // Use did from config if not provided (same logic as other endpoints)
        if (!did) {
          try {
            const config = loadConfig();
            did = config.did;
          } catch {}
        }
        
        if (!did) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'did is required (not found in request or config.json)' }));
          return;
        }
        
        const validActions = ['BR', 'BA', 'BM', 'BT', 'BS', 'run', 'auto', 'manual', 'test', 'stop'];
        if (!action || !validActions.includes(action)) {
          res.writeHead(400);
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Invalid action. Use: BR/run (Run), BA/auto (Auto), BM/manual (Manual), BT/test (Test), BS/stop (Stop)' 
          }));
          return;
        }
        
        // Convert friendly names to SCADA codes
        const actionMap = {
          'run': 'BR',
          'auto': 'BA',
          'manual': 'BM',
          'test': 'BT',
          'stop': 'BS'
        };
        const jobCode = actionMap[action.toLowerCase()] || action.toUpperCase();
        
        await ensureConnectedAndLoggedIn();
        
        const controlCmd = {
          Request: 'dev_click',
          job: jobCode,
          did: Number(did),
          cls: 'CTRL'
        };
        
        log('INFO', `Sending device control command: ${jobCode} to device ${did}`);
        persistentClient.send(controlCmd);
        
        // Wait a bit for potential response
        await new Promise(r => setTimeout(r, 500));
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          message: `Command ${jobCode} sent to device ${did}`,
          command: controlCmd
        }));
      } catch (e) {
        log('ERROR', 'Device control error:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Example: /api/any — universal proxy for SCADA requests (POST)
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
  log('INFO', '=== Rainbow SCADA Persistent HTTP+WS Server ===');
  log('INFO', `Server: http://localhost:${PORT}/api_test.html`);
  log('INFO', `Persistent WebSocket: ${persistentClient.config.ws_url}`);
  log('INFO', '\nEndpoints:');
  log('INFO', '  GET  /api/health');
  log('INFO', '  GET  /api/node_list');
  log('INFO', '  GET  /api/devx_list?node_id=ID');
  log('INFO', '  GET  /api/dump_devm?did=DEVICE_ID&node_id=NODE_ID — get all device parameters');
  log('INFO', '  GET  /api/dump_devm?id=ID[,ID...]&did=DEVICE_ID&node_id=NODE_ID — get specific parameters');
  log('INFO', '  GET  /api/dump_devm_param_names?did=DEVICE_ID&node_id=NODE_ID — get parameter names');
  log('INFO', '  GET  /api/dump_devm_alarm?did=DEVICE_ID&node_id=NODE_ID — get EXTRA.Alarm');
  log('INFO', '  GET  /api/dump_devm_leds?did=DEVICE_ID&node_id=NODE_ID — get EXTRA.Leds');
  log('INFO', '  GET  /api/dump_devm_dout?did=DEVICE_ID&node_id=NODE_ID — get EXTRA.Dout (digital outputs)');
  log('INFO', '  GET  /api/restart — restart WebSocket connection');
  log('INFO', '  POST /api/device/control — Device Control (Run/Auto/Manual/Test/Stop)');
  log('INFO', '       Body: {"did": <number>, "action": "BR|BA|BM|BT|BS" or "run|auto|manual|test|stop"}');
  log('INFO', '  POST /api/any — universal SCADA request proxy');
  log('INFO', '\nLogging: console + log.txt (max 5MB, 5 rotations)');
  log('INFO', 'File naming: dump_devm_{node_id}_{did}.json');
  log('INFO', 'Press Ctrl+C to stop\n');

  // Automatic login on startup
  ensureConnectedAndLoggedIn().catch(e => {
    log('ERROR', 'Autologin failed:', e.message);
    saveConnectionError(e);
  });
  
  // Periodic check for disconnect once per hour (check every 5 minutes)
  setInterval(() => {
    if (shouldDisconnectForMaintenance()) {
      persistentClient.disconnectForMaintenance();
    } else if (persistentClient.state === CONNECT_ENUM.WAITING && canReconnectAfterMaintenance()) {
      log('INFO', 'Attempting to reconnect after maintenance...');
      ensureConnectedAndLoggedIn().catch(e => {
        log('ERROR', 'Maintenance reconnect failed:', e.message);
      });
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
});
