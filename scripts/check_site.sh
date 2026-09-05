#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

required=(
  index.html
  styles.css
  app.js
  assets/favicon.svg
  assets/fonts/DroidSansFallbackFull.ttf
  assets/fonts/DroidSansFallbackFull.LICENSE
  scripts/serve_site.py
  assets/videos/elderly-speaker-source.mp4
  assets/videos/home-kitchen-source.mp4
  assets/videos/pottery-studio-source.mp4
  assets/videos/video-call-source.mp4
  assets/posters/elderly-speaker-source.jpg
  assets/posters/home-kitchen-source.jpg
  assets/posters/pottery-studio-source.jpg
  assets/posters/video-call-source.jpg
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
  case "$(basename "$video")" in
    elderly-speaker-source.mp4) expected_size="832x1472" ;;
    home-kitchen-source.mp4|pottery-studio-source.mp4) expected_size="1024x704" ;;
    video-call-source.mp4) expected_size="1248x704" ;;
    *) echo "[error] unexpected video asset: $video" >&2; exit 3 ;;
  esac
  actual_size="${width}x${height}"
  [[ "$codec" == h264 && "$actual_size" == "$expected_size" && "$fps" == 24/1 && "$frames" == 361 ]] || {
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
expected_sizes = {
    "elderly-speaker.json": (832, 1472),
    "home-kitchen.json": (1024, 704),
    "pottery-studio.json": (1024, 704),
    "video-call.json": (1248, 704),
}
case_fingerprints = set()
for path in sorted((root / "assets" / "manifests").glob("*.json")):
    data = json.loads(path.read_text())
    assert data["duration"] == 15.0, path
    assert data["tracks"] == ["FACE", "BODY", "MUSIC", "SPEECH"], path
    assert data["event_source"] == "derived", path
    assert len(data["events"]) == 12, path
    assert (data["media"]["width"], data["media"]["height"]) == expected_sizes[path.name], path
    assert data["media"]["render_mode"] == "source_video_plus_dom", path
    assert data["media"]["panel_flow"] == "web_horizontal", path
    assert "/primus_" not in path.read_text(), path
    case_fingerprints.add((data["anchor_text"], tuple(event["text"] for event in data["events"])))
assert len(case_fingerprints) == 4, "case manifests must carry distinct prompts"
print("[ok] 4 distinct manifests: derived timing, 4 tracks, 12 events each, no internal paths")
PY

grep -q '流式模型提示' index.html || { echo "[error] Chinese DOM panel is missing" >&2; exit 4; }
grep -q 'DroidSansFallbackFull.ttf' styles.css || { echo "[error] bundled CJK font is not wired" >&2; exit 4; }
grep -q 'const NOW_POSITION = 0.72' app.js || { echo "[error] calibrated NOW position is missing" >&2; exit 4; }

if grep -R -nE '/primus_(chat|xpfs)|VLM_ACCESS_KEY|VLM_API_KEY' index.html styles.css app.js assets/manifests; then
  echo "[error] internal path or credential token found in published assets" >&2
  exit 4
fi

if command -v node >/dev/null 2>&1; then
  node --check app.js
fi

echo "[ok] static page validation complete"
