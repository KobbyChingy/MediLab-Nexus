#!/usr/bin/env sh
set -eu

SKIP_BUILD="false"
USE_PM2="false"

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD="true" ;;
    --use-pm2) USE_PM2="true" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

echo "[medilab] Starting production preparation..."

if [ ! -f .env ]; then
  echo "Missing .env file. Copy .env.production.example or another deployment env file into .env first." >&2
  exit 1
fi

if [ "$SKIP_BUILD" != "true" ]; then
  npm run prepare:prod
fi

if [ "$USE_PM2" = "true" ]; then
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "PM2 is not installed or not on PATH. Install PM2 or run without --use-pm2." >&2
    exit 1
  fi

  echo "[medilab] Launching API and worker with PM2..."
  pm2 start deploy/ecosystem.config.cjs --update-env
  pm2 save
  exit 0
fi

echo "[medilab] Launching API and worker with npm start:prod..."
npm run start:prod