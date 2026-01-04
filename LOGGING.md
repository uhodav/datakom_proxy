# Logging System

## Overview

The server implements a dual-output logging system with automatic file rotation.

## Features

- **Dual Output**: All logs are written to both console and `log.txt` file
- **Automatic Rotation**: When log file reaches 5MB, it's automatically rotated
- **Multiple Archives**: Keeps up to 5 rotated log files (log.1.txt through log.5.txt)
- **Structured Format**: `[ISO timestamp] [LEVEL] message`
- **Log Levels**: INFO, WARN, ERROR, DEBUG

## Log Files

### Active Log
- `log.txt` - Current active log file

### Rotated Logs
- `log.1.txt` - Most recent rotated log
- `log.2.txt` - Second most recent
- `log.3.txt` - Third most recent
- `log.4.txt` - Fourth most recent
- `log.5.txt` - Oldest rotated log (automatically deleted when new rotation occurs)

## Log Format

```
[2026-01-03T10:15:30.123Z] [INFO] Server version: 42
[2026-01-03T10:15:30.456Z] [INFO] Connecting to: wss://rm.datakom.com.tr:464
[2026-01-03T10:15:31.789Z] [INFO] WebSocket connection established
[2026-01-03T10:15:32.012Z] [DEBUG] Received message: {"Request":"usr_fedai","fedai":"..."}
[2026-01-03T10:15:33.345Z] [ERROR] Login failed: Invalid credentials
```

## Log Levels

| Level | Purpose | Example |
|-------|---------|---------|
| **INFO** | General information, startup messages, state changes | Server start, connection established |
| **WARN** | Warnings, non-critical issues | Connection waiting, config issues |
| **ERROR** | Errors, failures | Connection failed, authentication error |
| **DEBUG** | Detailed debug information | Received messages, data processing |

## Configuration

Log rotation settings are defined in `server.js`:

```javascript
const LOG_FILE = path.join(__dirname, 'log.txt');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;
```

To modify:
1. Open `server.js`
2. Change `MAX_LOG_SIZE` for different rotation threshold
3. Change `MAX_LOG_FILES` for more/fewer archived logs

## Usage Examples

### View Active Log
```bash
# Linux/macOS
tail -f log.txt

# Windows PowerShell
Get-Content log.txt -Wait -Tail 50
```

### Search Logs
```bash
# Find errors
grep ERROR log.txt

# Find specific time period
grep "2026-01-03T10:" log.txt

# Search all logs including rotated
grep -h "connection failed" log*.txt
```

### Log Retention
Logs are kept based on rotation count, not time. To implement time-based retention:
- Use external tools like `logrotate` (Linux)
- Use scheduled tasks to clean old logs (Windows)
- Modify `rotateLog()` function to check file dates

## Integration

The logging system uses a simple `log()` function:

```javascript
log('INFO', 'Your message here');
log('ERROR', 'Error occurred:', error.message);
log('DEBUG', 'Data:', JSON.stringify(data));
```

All `console.log()` calls have been replaced with `log()` to ensure dual output.

## Performance

- File writes are synchronous (`fs.appendFileSync`) to ensure log order
- Rotation check happens on every log write
- Minimal performance impact due to small file size checks
- Consider using async logging for high-volume scenarios

## Monitoring

Monitor log health:

```bash
# Check log file size
ls -lh log.txt

# Count log entries by level
grep -c INFO log.txt
grep -c ERROR log.txt

# Last 10 errors
grep ERROR log.txt | tail -10
```

## Troubleshooting

### Issue: Log file not created
- Check write permissions in server directory
- Verify `LOG_FILE` path is correct
- Check console for `[LOG][ERROR]` messages

### Issue: Rotation not working
- Check `[LOG][ROTATE][ERROR]` in console
- Verify disk space available
- Check file permissions for renaming

### Issue: Console output but no file
- File write errors are logged to console only
- Check `[LOG][ERROR]` messages in console
- Verify path and permissions

## Best Practices

1. **Regular Review**: Check logs periodically for errors and warnings
2. **Disk Space**: Monitor disk usage, especially with high logging volumes
3. **Archival**: Implement external archival for long-term log retention
4. **Filtering**: Use log levels to filter noise (e.g., disable DEBUG in production)
5. **Monitoring**: Set up alerts for ERROR level messages

## Future Enhancements

Potential improvements:
- Async file writing for better performance
- Configurable log levels per module
- JSON formatted logs for easier parsing
- Integration with external logging services (Syslog, ELK stack, etc.)
- Timestamp-based rotation (daily, weekly)
- Compression of rotated logs
