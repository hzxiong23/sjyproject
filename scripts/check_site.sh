#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

required=(
  index.html
  styles.css
  app.js
  assets/favicon.svg
  scripts/serve_site.py
  assets/videos/elderly-speaker.mp4
  assets/videos/home-kitchen.mp4
  assets/videos/pottery-studio.mp4
  assets/videos/video-call.mp4
  assets/posters/elderly-speaker.jpg
  assets/posters/home-kitchen.jpg
  assets/posters/pottery-studio.jpg
  assets/posters/video-call.jpg
  assets/manifests/elderly-speaker.json
  assets/manifests/home-kitchen.json
  assets/manifests/pottery-studio.json
  assets/manifests/video-call.json
)

for path in "${required[@]}"; do
  [[ -s "$path" ]] || { echo "[error] missing or empty: $path" >&2; exit 2; }
done

command -v ffprobe >/dev/null 2>&1 || { echo "[error] ffprobe is required" >&2; exit 2; }
command -v ffmpeg >/dev/null 2>&1 || { echo "[error] ffmpeg is required" >&2; exit 2; }

for video in assets/videos/*.mp4; do
  IFS=, read -r codec width height fps frames < <(
    ffprobe -v error -select_streams v:0 \
      -show_entries stream=codec_name,width,height,avg_frame_rate,nb_frames \
      -of csv=p=0 "$video"
  )
  audio=$(ffprobe -v error -select_streams a:0 \
    -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$video")
  [[ "$codec" == h264 && "$width" == 834 && "$height" == 720 && "$fps" == 24/1 && "$frames" == 361 ]] || {
    echo "[error] unexpected video stream: $video" >&2
    exit 3
  }
  [[ "$audio" == aac ]] || { echo "[error] unexpected audio codec: $video" >&2; exit 3; }
  ffmpeg -nostdin -xerror -v error -i "$video" -f null -
  moov_offset=$(LC_ALL=C grep -oba -m1 'moov' "$video" | cut -d: -f1)
  [[ -n "$moov_offset" && "$moov_offset" -lt 4096 ]] || { echo "[error] moov atom is not front-loaded: $video" >&2; exit 3; }
  echo "[ok] $video"
done

python3 - "$project_dir" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for path in sorted((root / "assets" / "manifests").glob("*.json")):
    data = json.loads(path.read_text())
    assert data["duration"] == 15.0, path
    assert data["tracks"] == ["FACE", "BODY", "MUSIC", "SPEECH"], path
    assert data["event_source"] == "derived", path
    assert len(data["events"]) == 12, path
    assert "/primus_" not in path.read_text(), path
print("[ok] 4 manifests: derived timing, 4 tracks, 12 events each, no internal paths")
PY

if grep -R -nE '/primus_(chat|xpfs)|VLM_ACCESS_KEY|VLM_API_KEY' index.html styles.css app.js assets/manifests; then
  echo "[error] internal path or credential token found in published assets" >&2
  exit 4
fi

if command -v node >/dev/null 2>&1; then
  node --check app.js
fi

echo "[ok] static page validation complete"
