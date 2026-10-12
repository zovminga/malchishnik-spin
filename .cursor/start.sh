#!/usr/bin/env bash
set -euo pipefail
PORT=8765
if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/index.html"; then
  echo "static server already up on :${PORT}"
  exit 0
fi
exec python3 -m http.server "$PORT" --bind 0.0.0.0
