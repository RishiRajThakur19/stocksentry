# StockSentry Security Posture & Controls

## Controls Implemented (Stage 1)
- **Authentication & Token Lifecycle**:
  - Short-lived JWT access tokens (default 30 minutes) signed with `HS256` and `token_version` (`tv`) validation.
  - Refresh token rotation (`POST /api/auth/refresh`) with SHA-256 hashed storage in `refresh_tokens`; logout and deactivation revoke all refresh tokens and increment `token_version`.
  - Account lockout after 5 consecutive failed logins (15-minute lock, logged to `audit_logs`, admin unlock endpoint).
  - Strong password policy (minimum 10 characters, blocks common passwords and passwords containing the user's name or email) enforced on password change, reset, and registration.
  - Forced password change (`must_change_password=True`) for admin-created and bulk-uploaded users, blocking all other endpoints until completed.
  - Single-use, 30-minute password reset tokens stored as SHA-256 hashes.
- **Authorization & Scope**:
  - Server-side RBAC (`SUPER_ADMIN`, `REGIONAL_ADMIN`, `MANAGER`, `FIELD_WORKER`) and region/city territory checks on every endpoint; out-of-scope calls return `403`.
  - WebSocket (`/ws`) authenticates JWT on connect (`1008` close on invalid/inactive token) and filters events by user role, region, and city before delivery.
- **Transport, Headers & Containers**:
  - Caddy enforces HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, and `Content-Security-Policy`.
  - `/docs`, `/redoc`, and `/openapi.json` are disabled when `ENVIRONMENT=production` unless `ENABLE_DOCS=true`.
  - Containers run as non-root `appuser` (UID 1001).
- **Upload & Data Integrity**:
  - Excel uploads restricted to `.xlsx`, max 5 MB, max 2000 rows, `read_only=True`, `data_only=False`, and formula-prefix (`=`, `+`, `-`, `@`) rejection.
  - Stock reservations and `SELECT ... FOR UPDATE` row locks prevent double-allocation; `Idempotency-Key` prevents duplicate dispatches and bulk assignments.

## Known Risks & Trade-Offs
- **JWT Storage in `localStorage`**: Access and refresh tokens are currently stored in `localStorage` on the React SPA rather than `httpOnly; Secure; SameSite=Strict` cookies. This simplifies SPA/API token attachment across dev/proxy origins, but exposes tokens to XSS if a script injection vulnerability were introduced. Mitigated by strict CSP headers, React's default output escaping, and 30-minute access token expiry. Migrating to `httpOnly` cookies + CSRF double-submit token is recommended before public internet exposure.
