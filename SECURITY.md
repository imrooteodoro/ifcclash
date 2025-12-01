# Security Features

This document outlines the security measures implemented in the IFC Clash Detection API.

## Rate Limiting

Rate limits are enforced to prevent abuse and ensure fair resource allocation:

### Default Limits (All Endpoints)
- **200 requests per day** per IP address
- **50 requests per hour** per IP address

### Endpoint-Specific Limits

#### `/api/clash-detection` (Form Upload)
- **10 requests per hour**
- Reason: Compute-intensive operation with file uploads

#### `/api/saas/clash-detection` (Self-Provisioning API)
- **5 requests per hour**
- Reason: Most resource-intensive endpoint with base64 decoding and processing

#### `/api/export-clashes` (Export Results)
- **30 requests per hour**
- Reason: Less intensive but still requires processing

### Rate Limit Response
When rate limit is exceeded, the API returns:
```json
{
  "success": false,
  "error": "Rate limit exceeded: 5 per 1 hour"
}
```
HTTP Status: `429 Too Many Requests`

## File Upload Limits

### Maximum Upload Size
- **Total request size**: 100MB (enforced by Flask `MAX_CONTENT_LENGTH`)
- **Individual file size** (SaaS API): 50MB per file
- **Total payload size** (SaaS API): 100MB across all files

### File Count Limits
- **Maximum files per request**: 10 files
- Applies to both form upload and SaaS API endpoints

### Upload Size Exceeded Response
```json
{
  "success": false,
  "error": "File upload too large. Maximum size is 100MB."
}
```
HTTP Status: `413 Request Entity Too Large`

## Clash Set Limits

To prevent resource exhaustion:
- **Maximum clash sets per request**: 20 sets

This prevents users from submitting extremely large batch operations that could overwhelm the server.

## Input Validation

### File Validation
- File extensions are validated (`.ifc` expected)
- Base64 content is validated before decoding
- File names are sanitized when creating temporary files

### Payload Validation
- JSON payloads are validated for structure
- Required fields are checked (`name`, `content` for files)
- Clash set configurations are normalized and validated

### Error Responses
Invalid inputs return descriptive error messages with HTTP 400 status:
```json
{
  "success": false,
  "error": "Invalid base64 content for file model.ifc"
}
```

## Temporary File Management

### Cleanup on Error
- Temporary files are automatically deleted if processing fails
- Prevents disk space exhaustion from failed requests

### Temporary File Location
- All temporary files are stored in `/tmp`
- Files use secure random names via `tempfile.NamedTemporaryFile`

## CORS Configuration

Cross-Origin Resource Sharing (CORS) is enabled via `flask-cors`:
- Allows frontend applications to access the API
- Configure `CORS(app)` with specific origins in production

## Best Practices for Production

### 1. Use Redis for Rate Limiting
Replace in-memory storage with Redis for distributed rate limiting:
```python
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="redis://localhost:6379"
)
```

### 2. Configure Reverse Proxy
Use nginx or similar to:
- Add additional rate limiting at the proxy level
- Enforce HTTPS/TLS
- Add request size limits
- Filter malicious requests

### 3. Authentication & Authorization
For production SaaS API, implement:
- API key authentication
- JWT tokens for user sessions
- Per-user rate limits (not just IP-based)

### 4. Monitoring & Logging
- Log all API requests with timestamps and IP addresses
- Monitor rate limit violations
- Set up alerts for suspicious activity

### 5. Environment Variables
Configure limits via environment variables:
```python
MAX_FILES = int(os.getenv('MAX_FILES', 10))
MAX_CLASH_SETS = int(os.getenv('MAX_CLASH_SETS', 20))
RATE_LIMIT_HOUR = os.getenv('RATE_LIMIT_HOUR', '50 per hour')
```

## Security Headers

Consider adding security headers in production:
```python
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response
```

## Reporting Security Issues

If you discover a security vulnerability, please email security@example.com instead of using the issue tracker.
