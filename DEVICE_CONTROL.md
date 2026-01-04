# Device Control API

## Overview

The `/api/device/control` endpoint allows sending control commands to devices in the Datakom SCADA system.

## Endpoint

**POST** `/api/device/control`

## Request Format

```json
{
  "did": <number>,
  "action": "<action_code>"
}
```

### Parameters

- `did` (required) - Device ID (number)
- `action` (required) - Control action code

### Available Actions

| Action Code | Friendly Name | SCADA Code | Description |
|-------------|---------------|------------|-------------|
| `run` or `BR` | Run | BR | Start device in run mode |
| `auto` or `BA` | Auto | BA | Switch to automatic mode |
| `manual` or `BM` | Manual | BM | Switch to manual mode |
| `test` or `BT` | Test | BT | Start test mode |
| `stop` or `BS` | Stop | BS | Stop device |

You can use either friendly names (`run`, `auto`, `manual`, `test`, `stop`) or SCADA codes (`BR`, `BA`, `BM`, `BT`, `BS`).

## Examples

### Using curl

```bash
# Run device
curl -X POST http://localhost:8765/api/device/control \
  -H "Content-Type: application/json" \
  -d '{"did": 17693, "action": "run"}'

# Auto mode
curl -X POST http://localhost:8765/api/device/control \
  -H "Content-Type: application/json" \
  -d '{"did": 17693, "action": "auto"}'

# Stop device
curl -X POST http://localhost:8765/api/device/control \
  -H "Content-Type: application/json" \
  -d '{"did": 17693, "action": "stop"}'

# Using SCADA codes directly
curl -X POST http://localhost:8765/api/device/control \
  -H "Content-Type: application/json" \
  -d '{"did": 17693, "action": "BR"}'
```

### Using JavaScript

```javascript
async function controlDevice(did, action) {
  const response = await fetch('http://localhost:8765/api/device/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did, action })
  });
  return await response.json();
}

// Example usage
await controlDevice(17693, 'run');
await controlDevice(17693, 'stop');
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Command BR sent to device 17693",
  "command": {
    "Request": "dev_click",
    "job": "BR",
    "did": 17693,
    "cls": "CTRL"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid action. Use: BR/run (Run), BA/auto (Auto), BM/manual (Manual), BT/test (Test), BS/stop (Stop)"
}
```

## SCADA Protocol Details

Internally, the command is translated to the following SCADA format:

```json
{
  "Request": "dev_click",
  "job": "<SCADA_CODE>",
  "did": <device_id>,
  "cls": "CTRL"
}
```

This matches the protocol used by the C# Datakom client.

## Testing

1. Open `api_test.html` in your browser
2. Navigate to the "Device Control Commands" section
3. Enter the device ID (did)
4. Click one of the control buttons (Run, Auto, Manual, Test, Stop)
5. View the response in the result panel

## Notes

- The server must be connected to the SCADA system to send commands
- If the server is in PAUSED or WAITING state, commands will fail with an error
- Use `/api/health` to check connection status before sending commands
- The command is sent asynchronously; check device status separately to verify execution
