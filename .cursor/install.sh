#!/usr/bin/env bash
set -euo pipefail
# Static HTML app — no build deps required for the shipped product.
command -v python3 >/dev/null
python3 --version
