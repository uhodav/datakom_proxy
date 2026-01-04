# TLS Configuration (insecure_tls)

## Overview

The `insecure_tls` configuration option allows controlling SSL/TLS certificate validation when connecting to the WebSocket server.

## Configuration

In `config.json`:

```json
{
  "ws_url": "wss://rm.datakom.com.tr:464",
  "login": "username",
  "password": "password",
  "insecure_tls": true
}
```

## Options

| Value | Behavior | Use Case |
|-------|----------|----------|
| `true` | Disable certificate validation (`rejectUnauthorized: false`) | Self-signed certificates, development, testing |
| `false` | Enable certificate validation (`rejectUnauthorized: true`) | Production with valid CA-signed certificates |
| *(not set)* | Defaults to `false` (disabled validation) | Backward compatibility |

## When to Use insecure_tls: true

Use when:
- Server uses self-signed SSL certificate
- Testing in development environment
- Internal network with custom CA
- Certificate errors prevent connection

**⚠️ Warning**: Disabling certificate validation makes connections vulnerable to man-in-the-middle attacks. Only use in trusted environments.

## When to Use insecure_tls: false

Use when:
- Production environment
- Server has valid CA-signed certificate
- Security is critical
- Compliance requirements

## Examples

### Self-Signed Certificate (Development)

```json
{
  "ws_url": "wss://localhost:464",
  "login": "dev_user",
  "password": "dev_password",
  "insecure_tls": true
}
```

### Valid Certificate (Production)

```json
{
  "ws_url": "wss://secure-server.example.com:464",
  "login": "prod_user",
  "password": "prod_password",
  "insecure_tls": false
}
```

## Troubleshooting

### Error: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"

This means the SSL certificate can't be verified.

**Solution**:
1. If using self-signed cert: set `"insecure_tls": true`
2. If production: install proper CA certificate
3. Check if certificate is expired

### Error: "DEPTH_ZERO_SELF_SIGNED_CERT"

Server is using a self-signed certificate.

**Solution**:
- Set `"insecure_tls": true` if trusted
- Or install the self-signed cert in your system's trust store

### Error: "CERT_HAS_EXPIRED"

Certificate has expired.

**Solution**:
- Server admin should renew the certificate
- Temporarily use `"insecure_tls": true` (not recommended)

## Implementation Details

In `server.js`, the configuration is applied during WebSocket connection:

```javascript
connect() {
  const wsOptions = {};
  if (this.config.insecure_tls !== undefined) {
    wsOptions.rejectUnauthorized = !this.config.insecure_tls;
    log('INFO', 'TLS validation:', wsOptions.rejectUnauthorized ? 'enabled' : 'disabled');
  } else {
    wsOptions.rejectUnauthorized = false; // default for backward compatibility
  }
  
  this.ws = new WebSocket(this.config.ws_url, wsOptions);
}
```

## Logging

TLS configuration is logged on connection:

```
[2026-01-03T10:15:30.123Z] [INFO] TLS validation: disabled
[2026-01-03T10:15:30.456Z] [INFO] Connecting to: wss://rm.datakom.com.tr:464
```

Or:

```
[2026-01-03T10:15:30.123Z] [INFO] TLS validation: enabled
[2026-01-03T10:15:30.456Z] [INFO] Connecting to: wss://secure-server.com:464
```

## Security Best Practices

### Development Environment
- ✅ Use `insecure_tls: true` for self-signed certificates
- ✅ Clearly document this is development only
- ✅ Never commit production credentials with this setting

### Production Environment
- ❌ Never use `insecure_tls: true` in production
- ✅ Use proper CA-signed certificates
- ✅ Keep certificates up to date
- ✅ Monitor certificate expiration

### Certificate Management
1. **Obtain valid certificate**: Use Let's Encrypt or commercial CA
2. **Install certificate**: On the WebSocket server
3. **Test connection**: With `insecure_tls: false`
4. **Monitor expiration**: Set up alerts before expiration
5. **Automate renewal**: Use tools like certbot

## Alternative: ws:// (Unencrypted)

If TLS is not required, you can use unencrypted WebSocket:

```json
{
  "ws_url": "ws://server.example.com:464",
  "login": "username",
  "password": "password"
}
```

**⚠️ Warning**: Unencrypted connections send credentials in plain text. Only use on trusted private networks.

## Testing TLS Configuration

### Test with openssl
```bash
# Check certificate details
openssl s_client -connect rm.datakom.com.tr:464 -servername rm.datakom.com.tr

# Check certificate chain
openssl s_client -connect rm.datakom.com.tr:464 -showcerts
```

### Test with curl
```bash
# With certificate validation
curl -v --cacert ca-bundle.crt wss://rm.datakom.com.tr:464

# Without certificate validation (insecure)
curl -v -k wss://rm.datakom.com.tr:464
```

## Migration Guide

### From hardcoded to configurable

**Before** (hardcoded in server.js):
```javascript
this.ws = new WebSocket(this.config.ws_url, { rejectUnauthorized: false });
```

**After** (configurable):
```javascript
const wsOptions = {};
if (this.config.insecure_tls !== undefined) {
  wsOptions.rejectUnauthorized = !this.config.insecure_tls;
}
this.ws = new WebSocket(this.config.ws_url, wsOptions);
```

**Config change**:
Add to `config.json`:
```json
{
  ...existing config...,
  "insecure_tls": true
}
```

## Summary

- Use `insecure_tls: true` for development/self-signed certs
- Use `insecure_tls: false` for production with valid certs
- Default is `false` (disabled validation) for backward compatibility
- Always prefer valid certificates over disabling validation
- Monitor and log TLS configuration for security auditing
