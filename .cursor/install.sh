#!/usr/bin/env bash
set -euo pipefail
# Static HTML product + Playwright regression scripts.
command -v python3 >/dev/null
python3 --version
command -v node >/dev/null
node --version
command -v npm >/dev/null

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

# Prefer system Chrome when present (Cloud Agent images); else Playwright Chromium.
if [[ -x /usr/bin/google-chrome-stable || -x /usr/local/bin/google-chrome ]]; then
  echo "Using system Chrome for Playwright"
else
  npx playwright install --with-deps chromium
fi

echo "install ok"
