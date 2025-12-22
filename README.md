[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://stand-with-ukraine.pp.ua)

#### Ukraine is still suffering from Russian aggression, [please consider supporting Red Cross Ukraine with a donation](https://redcross.org.ua/en/).

[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner2-direct.svg)](https://stand-with-ukraine.pp.ua)


# Rainbow SCADA Persistent Server

> Node.js proxy service for persistent connection to Rainbow SCADA, with automatic reconnection, REST API, and state saving.

## Features
- Persistent WebSocket connection to Rainbow SCADA
- Automatic authentication and reconnection
- REST API for device and parameter data
- Connection state saved in `state.json`
- Last device dump saved in `dump_devm.json`

## File Structure

| File/Folder      | Purpose                                      |
|------------------|-----------------------------------------------|
| server.js        | Main Node.js server (HTTP + WebSocket)        |
| config.json      | Connection config (ws_url, login, password)   |
| state.json       | Current connection state                      |
| dump_devm.json   | Last device dump                              |
| errorCodes.js    | Rainbow SCADA error codes                     |
| api_test.html    | Test page for API                             |
| package.json     | Dependencies and start scripts                |

## Quick Start

1. **Install dependencies:**
	```bash
	npm install
	```
2. **Configure connection parameters:**
	- Open `config.json` and set:
	  - `ws_url` — WebSocket server address
	  - `login` — user login
	  - `password` — user password
	  - `did` — (optional) device ID
3. **Start the server:**
	```bash
	npm start
	```
4. **(Recommended) Add to startup with pm2:**
	```bash
	npm install -g pm2
	pm2 start server.js --name rainbow-scada-server
	pm2 save
	pm2 startup
	# Run the command shown by pm2 for autostart
	pm2 logs rainbow-scada-server
	pm2 describe rainbow-scada-server
	pm2 stop rainbow-scada-server
	pm2 delete rainbow-scada-server
	pm2 restart rainbow-scada-server
	```


## API

The server runs on port `8765`.

### Main Endpoints:

| Method | URL                                                        | Description                                 |
|--------|------------------------------------------------------------|---------------------------------------------|
| GET    | `/api/health`                                              | Server health check                         |
| GET    | `/api/node_list`                                           | Get user node list                          |
| GET    | `/api/devx_list?node=ID`                                   | Get device list for node                    |
| GET    | `/api/dump_devm?did=DEVICE_ID`                             | Get all parameters for device (by did)      |
| GET    | `/api/dump_devm?id=293,274,275&did=DEVICE_ID`              | Get parameter values by id for device       |
| GET    | `/api/dump_devm_param_names?did=DEVICE_ID`                 | Get all id and label from VALUE for device  |
| GET    | `/api/dump_devm_alarm?did=DEVICE_ID`                       | Get EXTRA.Alarm object for device           |
| GET    | `/api/dump_devm_leds?did=DEVICE_ID`                        | Get EXTRA.Leds object for device            |
| POST   | `/api/any`                                                 | Universal proxy request to SCADA            |

> **Note:** The `did` parameter is optional for all dump_devm endpoints. If not provided, the value from `did` in `config.json` is used.

#### File Naming

Device dumps are saved as `dump_devm_{node_id}_{did}.json` (e.g. `dump_devm_12345_17693.json`).
The latest dump for a device is used in API responses.

#### Node ID

The first node_id (key `id` of the first object in `NodeList` from `/api/node_list`) is automatically saved to `config.json` as `node_id`.
You can also provide `node_id` as a query parameter to all dump_devm endpoints for precise file selection:

| GET    | `/api/dump_devm?did=DEVICE_ID&node_id=NODE_ID`            | Get all parameters for device and node      |
| GET    | `/api/dump_devm_param_names?did=DEVICE_ID&node_id=NODE_ID`| Get all id and label for device and node    |
| GET    | `/api/dump_devm_alarm?did=DEVICE_ID&node_id=NODE_ID`      | Get EXTRA.Alarm for device and node         |
| GET    | `/api/dump_devm_leds?did=DEVICE_ID&node_id=NODE_ID`       | Get EXTRA.Leds for device and node          |

If not provided, node_id is taken from config.json.


### API Request Examples

```bash
curl http://localhost:8765/api/node_list
curl "http://localhost:8765/api/devx_list?node_id=12345"
curl "http://localhost:8765/api/dump_devm?did=17693&node_id=12345"
curl "http://localhost:8765/api/dump_devm?id=293,274,275&did=17693&node_id=12345"
curl "http://localhost:8765/api/dump_devm_param_names?did=17693&node_id=12345"
curl "http://localhost:8765/api/dump_devm_alarm?did=17693&node_id=12345"
curl "http://localhost:8765/api/dump_devm_leds?did=17693&node_id=12345"
```

### Test Page

Open `api_test.html` in your browser to test the API via UI.

## Dependencies

- Node.js >= 14
- ws
- axios (optional, for extended features)
- socks-proxy-agent (optional)

## Notes
- All connection parameters are in `config.json`.
- Connection state is in `state.json` (`connect_state` key).
- Device dumps are saved as `{node_id}_{did}_dump_devm.json`.
- Error codes are in `errorCodes.js`.

---
**Author:**
