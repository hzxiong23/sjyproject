#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

required=(
  index.html
  styles.css
  app.js
  assets/favicon.svg
  assets/audience/live-room-15s.json
  scripts/serve_site.py
  assets/videos/elderly-speaker-live-en-v6.mp4
  assets/videos/home-kitchen-live-en-v6.mp4
  assets/videos/pottery-studio-live-en-v6.mp4
  assets/videos/video-call-live-en-v6.mp4
  assets/posters/elderly-speaker-live-en-v6.jpg
  assets/posters/home-kitchen-live-en-v6.jpg
  assets/posters/pottery-studio-live-en-v6.jpg
  assets/posters/video-call-live-en-v6.jpg
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
    elderly-speaker-live-en-v6.mp4|home-kitchen-live-en-v6.mp4|pottery-studio-live-en-v6.mp4|video-call-live-en-v6.mp4) expected_size="406x720" ;;
    *) echo "[error] unexpected video asset: $video" >&2; exit 3 ;;
  esac
  actual_size="${width}x${height}"
  [[ "$codec" == h264 && "$actual_size" == "$expected_size" && "$fps" == 24/1 && "$frames" == 361 ]] || {
    echo "[error] unexpected video stream: $video" >&2
    exit 3
  }
  [[ "$audio" == aac ]] || { echo "[error] unexpected audio codec: $video" >&2; exit 3; }
  [[ $(stat -c %s "$video") -lt 5500000 ]] || { echo "[error] video exceeds the 5.5 MB quality budget: $video" >&2; exit 3; }
  ffmpeg -nostdin -xerror -v error -i "$video" -f null -
  moov_offset=$(LC_ALL=C grep -oba -m1 'moov' "$video" | cut -d: -f1)
  [[ -n "$moov_offset" && "$moov_offset" -lt 4096 ]] || { echo "[error] moov atom is not front-loaded: $video" >&2; exit 3; }
  echo "[ok] $video"
done

python3 - "$project_dir" <<'PY'
import json
import hashlib
import sys
from pathlib import Path

root = Path(sys.argv[1])
expected_sizes = {name: (406, 720) for name in (
    "elderly-speaker.json",
    "home-kitchen.json",
    "pottery-studio.json",
    "video-call.json",
)}
case_fingerprints = set()
expected_schedule = [
    ("FACE", 0.0, 3.3, 0.0, 8.3),
    ("BODY", 1.5, 6.0, 0.0, 11.0),
    ("MUSIC", 0.0, 5.0, 0.0, 10.0),
    ("SPEECH", 0.0, 5.0, 0.0, 10.0),
    ("FACE", 5.4, 9.6, 4.0, 14.6),
    ("BODY", 6.4, 11.0, 4.0, 15.0),
    ("MUSIC", 5.0, 10.0, 4.0, 15.0),
    ("SPEECH", 5.0, 10.0, 4.0, 15.0),
    ("FACE", 10.2, 13.7, 9.0, 15.0),
    ("BODY", 11.4, 14.8, 9.0, 15.0),
    ("MUSIC", 10.0, 15.0, 9.0, 15.0),
    ("SPEECH", 10.0, 15.0, 9.0, 15.0),
]
for path in sorted((root / "assets" / "manifests").glob("*.json")):
    data = json.loads(path.read_text())
    assert data["duration"] == 15.0, path
    assert data["tracks"] == ["FACE", "BODY", "MUSIC", "SPEECH"], path
    assert data["event_source"] == "derived", path
    assert len(data["events"]) == 12, path
    actual_schedule = [
        (event["track"], event["start"], event["end"], event["admitted_at"], event["evicted_at"])
        for event in data["events"]
    ]
    assert actual_schedule == expected_schedule, f"authored schedule drift: {path}"
    assert all(event["lifecycle_source"] == "authored" for event in data["events"]), path
    assert (data["media"]["width"], data["media"]["height"]) == expected_sizes[path.name], path
    assert data["media"]["render_mode"] == "audience_overlay_plus_dom", path
    assert data["media"]["panel_flow"] == "web_horizontal", path
    video = (path.parent / data["media"]["source_video"]).resolve()
    assert video.is_file(), video
    digest = hashlib.sha256(video.read_bytes()).hexdigest()
    assert digest == data["media"]["source_sha256"], video
    assert "/primus_" not in path.read_text(), path
    case_fingerprints.add((data["anchor_text"], tuple(event["text"] for event in data["events"])))
assert len(case_fingerprints) == 4, "case manifests must carry distinct prompts"
print("[ok] 4 distinct manifests: exact 0/4/9s authored admission schedule, 4 tracks, 12 events each")
PY

grep -q 'Streaming Model Prompts' index.html || { echo "[error] English DOM panel is missing" >&2; exit 4; }
grep -q 'preload="none"' index.html || { echo "[error] video must not preload before play" >&2; exit 4; }
grep -q 'const NOW_POSITION = 0.72' app.js || { echo "[error] calibrated NOW position is missing" >&2; exit 4; }
grep -q 'const MIN_PACKET_SPAN = 78 / 377' app.js || { echo "[error] upstream minimum packet width is missing" >&2; exit 4; }
grep -q 'const ADMISSION_SLIDE = 12 / 377' app.js || { echo "[error] upstream admission slide is missing" >&2; exit 4; }
grep -q 'function assignSublanes' app.js || { echo "[error] upstream sublane assignment is missing" >&2; exit 4; }

if grep -R -nE '/primus_(chat|xpfs)|VLM_ACCESS_KEY|VLM_API_KEY' index.html styles.css app.js assets/manifests assets/audience; then
  echo "[error] internal path or credential token found in published assets" >&2
  exit 4
fi

if grep -R -nP '[\x{3400}-\x{4DBF}\x{4E00}-\x{9FFF}\x{F900}-\x{FAFF}]' \
  index.html styles.css app.js README.md docs scripts assets/manifests assets/audience; then
  echo "[error] Han characters found in the English-only published sources" >&2
  exit 4
fi

if command -v node >/dev/null 2>&1; then
  node --check app.js
fi

echo "[ok] static page validation complete"
