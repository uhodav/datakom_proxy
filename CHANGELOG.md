# Changelog - Version Update

## Summary of Changes

This update adds three major features requested by the user:
1. **Configurable TLS validation** (`insecure_tls` setting)
2. **Log rotation system** (automatic file-based logging)
3. **Device Control endpoint** (dedicated API for Run/Auto/Manual/Test/Stop commands)

---

## 1. Configurable TLS Validation

### What Changed
- Added `insecure_tls` field to `config.json`
- Modified WebSocket connection to use config setting instead of hardcoded value
- Added logging for TLS validation status

### Configuration
```json
{
  "insecure_tls": true  // false to enable certificate validation
}
```

### Benefits
- Flexibility to enable/disable certificate validation
- Better security in production (set to `false`)
- Easy testing with self-signed certificates (set to `true`)
- Logged for audit purposes

### Files Modified
- `config.json` - Added `insecure_tls: true`
- `server.js` - Lines ~388-398 (connect method)

### Documentation
- See `TLS_CONFIG.md` for detailed usage

---

## 2. Log Rotation System

### What Changed
- Implemented dual-output logging (console + file)
- Added automatic log rotation at 5MB
- Keeps up to 5 rotated log files
- Replaced all `console.log()` calls with `log()` function

### Features
- **Log file**: `log.txt` (active), `log.1.txt` through `log.5.txt` (archives)
- **Format**: `[ISO timestamp] [LEVEL] message`
- **Levels**: INFO, WARN, ERROR, DEBUG
- **Auto-rotation**: When file reaches 5MB
- **Archive limit**: 5 files (oldest deleted on rotation)

### Configuration
```javascript
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;
```

### Benefits
- Persistent logging for debugging
- Automatic management (no manual cleanup needed)
- Structured format for parsing
- Historical data retention

### Files Modified
- `server.js` - Added log system (lines ~5-58)
- All `console.log()` replaced with `log()` throughout

### Documentation
- See `LOGGING.md` for detailed usage

---

## 3. Device Control Endpoint

### What Changed
- Added new endpoint: `POST /api/device/control`
- Supports friendly action names (`run`, `auto`, `manual`, `test`, `stop`)
- Also accepts SCADA codes (`BR`, `BA`, `BM`, `BT`, `BS`)
- Added UI controls in `api_test.html`

### API Format
```bash
curl -X POST http://localhost:8765/api/device/control \
  -H "Content-Type: application/json" \
  -d '{"did": 17693, "action": "run"}'
```

### Supported Actions
| Action | SCADA Code | Description |
|--------|------------|-------------|
| `run` | BR | Start device |
| `auto` | BA | Automatic mode |
| `manual` | BM | Manual mode |
| `test` | BT | Test mode |
| `stop` | BS | Stop device |

### Response Format
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

### Benefits
- Easy-to-use device control
- Friendly action names + SCADA codes
- Validation and error handling
- Visual UI in test page

### Files Modified
- `server.js` - Added endpoint (lines ~1005-1062)
- `api_test.html` - Added control buttons and JavaScript
- `README.md` - Updated with Device Control examples

### Documentation
- See `DEVICE_CONTROL.md` for detailed API reference

---

## Additional Changes

### README.md Updates
- Added Device Control endpoint documentation
- Added curl examples for device control
- Added Logging section with rotation details
- Added Configuration section with all parameters
- Updated endpoint table

### Test Page Updates (`api_test.html`)
- Added Device Control section with 5 colored buttons
- Visual indicators (▶️ Run, 🔄 Auto, ✋ Manual, 🔧 Test, ⏹️ Stop)
- Input field for device ID
- JavaScript function `callDeviceControl()`

### Server Startup Message
- Updated to show new endpoint
- Added logging configuration info
- Improved formatting

---

## Testing

### Test TLS Configuration
1. Check `config.json` has `"insecure_tls": true`
2. Start server: `npm start`
3. Look for log line: `[INFO] TLS validation: disabled`
4. Change to `false` and verify: `[INFO] TLS validation: enabled`

### Test Log Rotation
1. Start server: `npm start`
2. Check `log.txt` is created
3. Perform many operations to generate logs
4. When file reaches 5MB, verify `log.1.txt` is created

### Test Device Control
1. Open `http://localhost:8765/api_test.html`
2. Scroll to "Device Control Commands"
3. Enter device ID (e.g., 17693)
4. Click any button (Run, Auto, Manual, Test, Stop)
5. Verify response shows success

**Or use curl:**
```bash
curl -X POST http://localhost:8765/api/device/control \
  -H "Content-Type: application/json" \
  -d '{"did": 17693, "action": "run"}'
```

---

## Compatibility

### Backward Compatibility
- ✅ All existing endpoints unchanged
- ✅ Config: `insecure_tls` defaults to `false` if not set
- ✅ Logging: Console output still works as before
- ✅ API responses unchanged

### Breaking Changes
- None

---

## Migration Guide

### From Previous Version

1. **Update config.json**:
   ```json
   {
     ...existing settings...,
     "insecure_tls": true
   }
   ```

2. **No code changes required** - Update is backward compatible

3. **Optional**: Use new Device Control endpoint instead of `/api/any`

4. **Optional**: Monitor `log.txt` for file-based logs

---

## Files Added
- `DEVICE_CONTROL.md` - Device Control API documentation
- `LOGGING.md` - Logging system documentation  
- `TLS_CONFIG.md` - TLS configuration guide
- `CHANGELOG.md` - This file

## Files Modified
- `config.json` - Added `insecure_tls`
- `server.js` - All three features implemented
- `README.md` - Updated documentation
- `api_test.html` - Added Device Control UI

## Files Generated at Runtime
- `log.txt` - Active log file
- `log.1.txt` through `log.5.txt` - Rotated log archives

---

## Future Enhancements

Potential improvements for next version:
- [ ] Async file logging for better performance
- [ ] Configurable log levels (e.g., disable DEBUG in production)
- [ ] WebSocket fallback to `ws://` if `wss://` fails
- [ ] Unit tests for all features
- [ ] Environment variable support for sensitive config
- [ ] JSON log format option for log parsing tools

---

## Support

For questions or issues:
1. Check documentation files (DEVICE_CONTROL.md, LOGGING.md, TLS_CONFIG.md)
2. Review README.md for API examples
3. Check `log.txt` for error messages
4. Use `/api/health` to verify server status

---

**Version**: Updated January 3, 2026  
**Node.js**: >= 16 recommended  
**Dependencies**: ws, axios, socks-proxy-agent
