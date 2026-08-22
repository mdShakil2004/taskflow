#!/usr/bin/env bash
# Generates frontend/.env with the correct API URL for wherever this is
# running — a GitHub Codespace, or a plain local/non-Codespaces machine.
#
# Why this is needed: in Codespaces, the React app's JS runs in the
# developer's OWN browser, not inside the container. That browser has no
# route to "localhost:3000" (that's the Codespace's internal network, not
# the developer's machine) — it must call the API's public forwarded URL,
# which looks like:
#
#   https://<codespace-name>-3000.<forwarding-domain>
#
# GitHub Codespaces automatically injects CODESPACE_NAME and
# GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN into every terminal session, so
# this script builds the URL from those — nothing hardcoded or guessed.
# Outside Codespaces, it falls back to plain localhost.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  API_URL="https://${CODESPACE_NAME}-3000.${DOMAIN}"
  echo "Detected GitHub Codespaces (${CODESPACE_NAME}). API URL: ${API_URL}"
else
  API_URL="http://localhost:3000"
  echo "Not running in Codespaces. API URL: ${API_URL}"
fi

echo "VITE_API_URL=${API_URL}" > frontend/.env
echo "Wrote frontend/.env"
