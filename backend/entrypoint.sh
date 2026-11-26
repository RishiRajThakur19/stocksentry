#!/usr/bin/env sh
set -eu

echo "Running Alembic database migrations..."
alembic upgrade head

echo "Starting StockSentry Gunicorn server..."
exec gunicorn -c gunicorn_conf.py app.main:app
