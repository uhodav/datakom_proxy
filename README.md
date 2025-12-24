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
| data/            | All runtime JSON files (dumps, state, lists)  |
| data/config.json | Connection config (ws_url, login, password)   |
| data/state.json  | Current connection state                      |
| data/node_list.json | Last received node list                    |
| data/dump_devm_{node_id}_{did}.json | Device dump per node/device |
| data/devx_list_{node_id}.json | Device list per node             |
| data/version.txt | Server version counter                        |
| errorCodes.js    | Rainbow SCADA error codes                     |
| api_test.html    | Test page for API                             |
| package.json     | Dependencies and start scripts                |
## Data Directory

All runtime JSON files (device dumps, lists, config, state, version) are now stored in the `data/` directory. This keeps the project root clean and makes it easier to manage files and .gitignore rules.

**On first run, the server will create the `data/` directory if it does not exist.**

## Multi-Node and Device Support

- The server supports multiple nodes and devices. Device dumps and lists are saved per node and device using the naming pattern:
	- `data/dump_devm_{node_id}_{did}.json`
	- `data/devx_list_{node_id}.json`
- The first node_id is auto-saved to config for convenience, but you can specify `node_id` and `did` in API queries for precise access.

## Improved File Naming and Config Fallback

- All file operations use robust naming and fallback to config values if parameters are missing.
- If a parameter is not provided in the API request, the value from `data/config.json` is used.

## Error Handling

- The server logs warnings and errors for file operations and connection issues.
- Connection state is always saved to `data/state.json`.

## Dependencies

- Node.js >= 14
- ws (WebSocket client/server)
- axios (optional, for extended features)
- socks-proxy-agent (optional, for proxy support)

Install all dependencies with `npm install`.

## Versioning

- The server auto-increments a version counter in `data/version.txt` on each start.

## .gitignore

- The `data/` directory and its contents (except for templates) should be added to `.gitignore` to avoid committing runtime data.


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

| Method | URL & Query Parameters                                                                 | Description                                 |
|--------|----------------------------------------------------------------------------------------|---------------------------------------------|
| GET    | `/api/health`                                                                          | Server health check                         |
| GET    | `/api/node_list`                                                                       | Get user node list                          |
| GET    | `/api/devx_list?node_id=NODE_ID`                                                       | Get device list for node                    |
| GET    | `/api/dump_devm?did=DEVICE_ID&node_id=NODE_ID&id=ID1,ID2,...`                          | Get parameters (all or by id) for device/node|
| GET    | `/api/dump_devm_param_names?did=DEVICE_ID&node_id=NODE_ID`                             | Get all id and label from VALUE for device/node|
| GET    | `/api/dump_devm_alarm?did=DEVICE_ID&node_id=NODE_ID`                                   | Get EXTRA.Alarm object for device/node      |
| GET    | `/api/dump_devm_leds?did=DEVICE_ID&node_id=NODE_ID`                                    | Get EXTRA.Leds object for device/node       |
| GET    | `/api/restart`                                                                         | Restart WebSocket connection                |
| POST   | `/api/any` (body: JSON SCADA request)                                                  | Universal proxy request to SCADA            |

**Parameters:**
- `node_id` — Node ID (optional, uses config if not provided)
- `did` — Device ID (optional, uses config if not provided)
- `id` — Comma-separated parameter IDs (optional, for /api/dump_devm)

> If `node_id` or `did` are not provided, values from `data/config.json` are used as fallback.

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
curl http://localhost:8765/api/restart
```

### Test Page

Open `api_test.html` in your browser to test the API via UI.

## Dependencies

- Node.js >= 14
- ws
- axios (optional, for extended features)
- socks-proxy-agent (optional)

## Notes
- All connection parameters are in `data/config.json`.
- Connection state is in `data/state.json` (`connect_state` key).
- Device dumps are saved as `data/dump_devm_{node_id}_{did}.json`.
- Device lists are saved as `data/devx_list_{node_id}.json`.
- Error codes are in `errorCodes.js`.
- All runtime JSON files are isolated in `data/` for easier management and git hygiene.

---
**Author:**
