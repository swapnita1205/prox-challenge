#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/python ]]; then
  echo "Creating Python venv at .venv ..."
  python3 -m venv .venv
  .venv/bin/pip install -r scripts/ingest/requirements.txt
fi

exec .venv/bin/python scripts/ingest/pipeline.py
