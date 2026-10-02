#!/bin/sh
set -eu

if [ -z "${ALERT_INGESTION_TOKEN:-}" ]; then
  if [ "${WEATHERGPT_MODE:-production}" = "production" ]; then
    echo "ERROR: ALERT_INGESTION_TOKEN is required in production." >&2
    exit 1
  fi

  ALERT_INGESTION_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
  export ALERT_INGESTION_TOKEN
  echo "WARNING: generated an ephemeral demo ALERT_INGESTION_TOKEN; set a persistent secret before production." >&2
fi

exec "$@"
