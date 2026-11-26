# StockSentry Operations Runbook

## 1. Deploy / Update
1. Pull latest code and verify `.env` from `.env.production.example`.
2. Build and start services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. The backend container entrypoint (`backend/entrypoint.sh`) runs `alembic upgrade head` automatically before starting Gunicorn.
4. For initial production seeding (regions, cities, optional `INITIAL_ADMIN_*` without demo credentials):
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python scripts/seed_prod.py
   ```

## 2. Database Migrations (Alembic)
- Check current revision: `alembic current`
- Apply pending migrations: `alembic upgrade head`
- Roll back one revision: `alembic downgrade -1`
- One-off SQLite to PostgreSQL migration:
  ```bash
  SQLITE_URL=sqlite:///./stocksentry.db POSTGRES_URL=postgresql://... python scripts/migrate_sqlite_to_postgres.py
  ```

## 3. Backup & Restore
- **Nightly backup**: Run `backend/backup.sh` via cron (keeps 7 daily, 4 weekly snapshots, optional `rclone` offsite sync, emails `ALERT_EMAIL` on failure).
- **Restore**:
  ```bash
  DATABASE_URL=postgresql://... ./backend/restore.sh /var/backups/stocksentry/daily/stocksentry_YYYYMMDD_HHMMSS.sql.gz
  ```

## 4. Rotate Secrets
1. Update `SECRET_KEY` in `.env` and restart `backend` (`docker compose -f docker-compose.prod.yml up -d backend`). All existing JWTs are invalidated immediately.
2. For per-user revocation, use `POST /api/auth/logout` or deactivate the user (`is_active=0`).

## 5. Add or Unlock a User
- Admins create users via **User & Hub Directory** or `POST /api/users` (sets `must_change_password=True`).
- Locked accounts (after 5 failed logins) auto-unlock after 15 minutes or via `POST /api/users/{user_id}/unlock`.

## 6. Common Failures
- **`/ready` returns `degraded`**: Check `postgres` and `redis` container health (`docker compose ps`).
- **403 `Password change required`**: User has `must_change_password=True` and must complete `POST /api/auth/change-password`.
- **423 `Account temporarily locked`**: Wait 15 minutes or have a Regional/Super Admin unlock the account.
