#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
port="${PORT:-8000}"

exec python3 "$project_dir/scripts/serve_site.py" \
  --bind 127.0.0.1 \
  --port "$port" \
  --directory "$project_dir"
