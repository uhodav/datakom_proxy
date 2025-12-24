const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
  } catch (e) {
    console.log('[BINARY][ERROR]', e.message);
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
} catch (e) {
  console.log('[WARN] Could not update the version:', e.message);
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
CONNECTING: 'Connecting'
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
    fs.writeFileSync(STATE_PATH, JSON.stringify({ connect_state: state }, null, 2), 'utf-8');
  } catch (e) {
    console.log('[WARN] Could not save state:', e.message);
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
        console.log('node_id', node_id, 'did', did);
        console.log('this.config', this.config)
        const fname = getDumpDevmFileName(node_id, did);
        fs.writeFileSync(path.join(DATA_DIR, fname), JSON.stringify(msg, null, 2), 'utf-8');
      } catch (e) {
        console.log('[DUMP_DEVM][ERROR]', e.message);
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
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(this.config.ws_url, { rejectUnauthorized: false });
        this.ws.on('open', () => {
          this.setState(CONNECT_ENUM.WAITING_CHALLENGE);
          resolve();
        });
        this.ws.on('error', (err) => {
          this.setState(CONNECT_ENUM.ERROR);
          console.error(`[WS][ERROR]:`, err.message);
          reject(err);
        });
        this.ws.on('close', (code, reason) => {
          isLoggedIn = false;
          this.setState(CONNECT_ENUM.RECONNECTING);
          console.log(`[WS][CLOSE]: code=${code}, reason=${reason}`);
          //this.login();
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
      if (msg.Request === 'dump_devm' && msg.MSG) {
        this.saveDumpDevm(msg.MSG);
      } else if (msg.Binary && msg.Data) {
        
        saveBinaryPacket(msg.Data);
      }
      if (msg.Request === 'user_warn' && (msg.ErrText === 'Multiple Logon Error' || msg.ErrCode === -1010)) {
        isLoggedIn = false;
        const errText = getErrorText(msg.ErrCode) || msg.ErrText;
        console.log(`[RECONNECT] Multiple Logon Error: initiating reconnect... (${msg.ErrCode}: ${errText})`);
        this.close();
      }
      if (msg.Request === 'usr_fedai') this.fedaiChallenge = msg.fedai;
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
            console.log('[SCADA][ERROR] Could not save devx_list:', e.message);
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
      this.setState(CONNECT_ENUM.AUTHENTICATING);
      await this.waitForMessage('usr_fedai', 10000);
      if (!this.fedaiChallenge) throw new Error('No fedai challenge received');
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
      this.send(loginReq);
      const loginResponse = await this.waitForMessage('usr_login', 20000);
      if (!loginResponse.UsrIdt) throw new Error('Login failed');
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
        console.log('[LOGIN][ERROR] Could not save node_list:', e.message);
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
          console.log('[AUTO] No devices for devx_pump');
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
}


const http = require('http');
const url = require('url');

const persistentClient = new RainbowClient();
let isLoggedIn = false;
let isConnecting = false;
let connectPromise = null;

async function ensureConnectedAndLoggedIn() {
  if (persistentClient.ws && persistentClient.ws.readyState === WebSocket.OPEN && isLoggedIn) {
    return;
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
      console.log('[LOGIN][ERROR]', e.message);
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
    try {
      const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
      const stateObj = JSON.parse(stateData);
      connect_state = stateObj.connect_state || null;
    } catch {}
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      time: new Date().toISOString(),
      connect_state
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
      let connect_state = null;
      try {
        const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
        const stateObj = JSON.parse(stateData);
        connect_state = stateObj.connect_state || null;
      } catch {}
      if (connect_state === CONNECT_ENUM.CONNECTED && fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        let params = [];
        if (data && data.VALUE && Array.isArray(data.VALUE)) {
          params = data.VALUE.filter(item => item.A !== undefined && item.N).map(item => ({ id: item.A, label: item.N }));
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, params }));
        return;
      } else if (!fs.existsSync(dumpPath)) {
        // No file, try to login and fetch from WS
        await ensureConnectedAndLoggedIn();
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        // Wait for dump_devm message
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
          let params = [];
          if (dumpMsg.MSG.VALUE && Array.isArray(dumpMsg.MSG.VALUE)) {
            params = dumpMsg.MSG.VALUE.filter(item => item.A !== undefined && item.N).map(item => ({ id: item.A, label: item.N }));
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, params }));
          return;
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No dump_devm data available from WS' }));
          return;
        }
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'No dump_devm data available' }));
        return;
      }
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
      let connect_state = null;
      try {
        const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
        const stateObj = JSON.parse(stateData);
        connect_state = stateObj.connect_state || null;
      } catch {}
      if (connect_state === CONNECT_ENUM.CONNECTED && fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        const alarm = data && data.EXTRA && data.EXTRA.Alarm ? data.EXTRA.Alarm : null;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, alarm }));
        return;
      } else if (!fs.existsSync(dumpPath)) {
        await ensureConnectedAndLoggedIn();
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
          const alarm = dumpMsg.MSG.EXTRA && dumpMsg.MSG.EXTRA.Alarm ? dumpMsg.MSG.EXTRA.Alarm : null;
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, alarm }));
          return;
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No dump_devm data available from WS' }));
          return;
        }
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'No dump_devm data available' }));
        return;
      }
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
      let connect_state = null;
      try {
        const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
        const stateObj = JSON.parse(stateData);
        connect_state = stateObj.connect_state || null;
      } catch {}
      if (connect_state === CONNECT_ENUM.CONNECTED && fs.existsSync(dumpPath)) {
        const data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
        const leds = data && data.EXTRA && data.EXTRA.Leds ? data.EXTRA.Leds : null;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, leds }));
        return;
      } else if (!fs.existsSync(dumpPath)) {
        await ensureConnectedAndLoggedIn();
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
          const leds = dumpMsg.MSG.EXTRA && dumpMsg.MSG.EXTRA.Leds ? dumpMsg.MSG.EXTRA.Leds : null;
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, leds }));
          return;
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No dump_devm data available from WS' }));
          return;
        }
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'No dump_devm data available' }));
        return;
      }
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Example: /api/node_list — get node_list via persistent WS
  if (pathname === '/api/node_list') {
    const nodeListPath = path.join(DATA_DIR, 'node_list.json');
    let connect_state = null;
    try {
      try {
        const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
        const stateObj = JSON.parse(stateData);
        connect_state = stateObj.connect_state || null;
      } catch {}
      if (connect_state === CONNECT_ENUM.CONNECTED && fs.existsSync(nodeListPath)) {
        const nodeList = JSON.parse(fs.readFileSync(nodeListPath, 'utf-8'));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: nodeList }));
        return;
      } else if (!fs.existsSync(nodeListPath)) {
        await ensureConnectedAndLoggedIn();
        persistentClient.send({ Request: 'node_list' });
        const nodeList = await persistentClient.waitForMessage('node_list', 10000);
        fs.writeFileSync(nodeListPath, JSON.stringify(nodeList, null, 2), 'utf-8');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: nodeList }));
        return;
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'No node_list data available' }));
        return;
      }
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
    let connect_state = null;
    try {
      try {
        const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
        const stateObj = JSON.parse(stateData);
        connect_state = stateObj.connect_state || null;
      } catch {}
      if (connect_state === CONNECT_ENUM.CONNECTED && fs.existsSync(devxListPath)) {
        const devxList = JSON.parse(fs.readFileSync(devxListPath, 'utf-8'));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: devxList }));
        return;
      } else if (!fs.existsSync(devxListPath)) {
        await ensureConnectedAndLoggedIn();
        persistentClient.send({ Request: 'devx_list', Node: nodeId, Skip: 0 });
        const devxList = await persistentClient.waitForMessage('devx_list', 10000);
        fs.writeFileSync(devxListPath, JSON.stringify(devxList, null, 2), 'utf-8');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: devxList }));
        return;
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'No devx_list data available' }));
        return;
      }
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
      let connect_state = null;
      try {
        const stateData = fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf-8');
        const stateObj = JSON.parse(stateData);
        connect_state = stateObj.connect_state || null;
      } catch {}
      let data = null;
      if (connect_state === CONNECT_ENUM.CONNECTED && fs.existsSync(dumpPath)) {
        data = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
      } else if (!fs.existsSync(dumpPath)) {
        await ensureConnectedAndLoggedIn();
        persistentClient.send({ Request: 'dump_devm', did, node_id });
        const dumpMsg = await persistentClient.waitForMessage('dump_devm', 10000);
        if (dumpMsg && dumpMsg.MSG) {
          fs.writeFileSync(dumpPath, JSON.stringify(dumpMsg.MSG, null, 2), 'utf-8');
          data = dumpMsg.MSG;
        }
      }
      if (!data) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'No dump_devm data available' }));
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
      res.end(JSON.stringify({ success: true, result }));
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
      // Wait a bit before reconnecting
      setTimeout(async () => {
        try {
          await ensureConnectedAndLoggedIn();
        } catch (e) {
          console.log('[RESTART][ERROR]', e.message);
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
  console.log(`\n=== Rainbow SCADA Persistent HTTP+WS Server ===`);
  console.log(`Server: http://localhost:${PORT}/api_test.html`);
  console.log(`Persistent WebSocket: ${persistentClient.config.ws_url}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/node_list`);
  console.log(`  GET  /api/devx_list?node_id=ID`);
  console.log(`  GET  /api/dump_devm?did=DEVICE_ID&node_id=NODE_ID — get all device parameters (array { id, label, value, unit })`);
  console.log(`  GET  /api/dump_devm?id=ID[,ID...]&did=DEVICE_ID&node_id=NODE_ID — get parameter values by id (comma-separated)`);
  console.log(`  GET  /api/dump_devm_param_names?did=DEVICE_ID&node_id=NODE_ID — get all id and label from VALUE`);
  console.log(`  GET  /api/dump_devm_alarm?did=DEVICE_ID&node_id=NODE_ID — get EXTRA.Alarm object`);
  console.log(`  GET  /api/dump_devm_leds?did=DEVICE_ID&node_id=NODE_ID — get EXTRA.Leds object`);
  console.log(`  GET  /api/restart — restart WebSocket connection`);
  console.log(`  POST /api/any  (body=Request)`);
  console.log(`\nFile naming: dump_devm_{node_id}_{did}.json (e.g. dump_devm_12345_17693.json)`);
  console.log(`If did or node_id is not provided, did and node_id from config.json are used.`);
  console.log(`\nPress Ctrl+C to stop\n`);
  // Automatic login on startup
  ensureConnectedAndLoggedIn().catch(e => {
    console.log('[AUTOLOGIN][ERROR]', e.message);
  });
});
