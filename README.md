# LiveDirector GitHub Pages demo

Standalone static project page for four selected LiveDirector demonstrations. It uses plain HTML, CSS, and JavaScript with no build step and no third-party runtime dependency.

## Local preview

```bash
bash serve.sh
```

Then open <http://127.0.0.1:8000>. The included local server supports MP4 Range requests, so cue-to-video seeking works during preview. Do not open `index.html` directly with `file://`; the page loads sanitized cue manifests with `fetch()`.

## Validate

```bash
bash scripts/check_site.sh
```

## Publish with GitHub Pages

Copy this directory to the root of a GitHub Pages repository, or to that repository's configured Pages source directory. The site is fully relative-path based; `.nojekyll` keeps the assets unchanged.

The four MP4 files are the native generated outputs, losslessly remuxed as H.264/AAC with the `moov` atom at the front for browser streaming. Each file is under 18 MB.

## Contents

```text
index.html               page structure and content
styles.css               responsive visual system
app.js                   case switching and synchronized timeline
assets/videos/           four native generated videos (no baked-in panel)
assets/posters/          poster frames extracted at 7.5 seconds
assets/manifests/        sanitized authored-cue metadata
assets/fonts/            bundled CJK webfont and license
scripts/check_site.sh    static and media validation
scripts/serve_site.py    dependency-free local server with MP4 Range support
docs/DESIGN_NOTES.md     design rationale and source mapping
```
