# SSL Certificates

Place your SSL certificate files in this directory:

- `key.pem` — Private key
- `cert.pem` — Certificate
- `ca.pem` — CA certificate chain (optional)

All certificate files are gitignored.

## Generate Self-Signed Certs (Development)

```bash
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"
```
