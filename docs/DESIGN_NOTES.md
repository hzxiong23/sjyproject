# Design notes

## Goal

Replace the earlier single rendered-video handoff with a GitHub Pages-style interactive project page. The page must foreground four user-selected demo files, work as a static site, and remain legible on desktop and mobile.

## Reference interpretation

The Temporal Context Routing project page was used as an information-architecture reference: a dark editorial hero, restrained technical color, sticky in-page navigation, numbered sections, large playable examples, and a time-aligned explanation of authored controls. This implementation does not copy its title, text, figures, JavaScript, or CSS.

LiveDirector uses a warmer coral identity and the four colors already present in the supplied demo compositor:

- FACE: amber;
- BODY: cyan;
- MUSIC: violet;
- SPEECH: green.

## Why one player

All four supplied MP4 files are 15.041667-second, 834×720 H.264/AAC composites. A single player with a visual case rail avoids downloading and decoding four videos simultaneously, makes comparison deliberate, and performs better on mobile GitHub Pages visits.

The webpage timeline is generated from the matching manifests and stays synchronized with `video.currentTime`. Clicking a segment seeks to its authored start. The current-cue cards expose full text that is truncated inside the compact video compositor.

## Evidence boundary

All four manifests state `event_source: "derived"`. The webpage therefore labels the timeline as authored/derived and does not describe it as a measured runtime trace. Configuration labels are parsed from the frozen file provenance supplied for this task; the page makes no comparative quality or speed claim.

## Selected cases

| Web label | Source scenario | Source aspect before presentation |
| --- | --- | --- |
| The reveal | elderly woman, thumbs-up/pointing livestream | 832×1472 |
| Kitchen notes | male half-body, home kitchen | 1024×704 |
| Craft in motion | female half-body, pottery studio | 1024×704 |
| Plan, revised | woman, home video call gesture | 1248×704 |

## Known source limitation

The supplied composite videos were rendered with DejaVu Sans while their chrome contains Chinese strings, so some interface glyphs inside the MP4 appear as boxes. The static webpage uses English UI and does not alter or conceal the selected videos. Fixing those baked-in glyphs requires re-rendering the composites from their raw source videos with a CJK-capable font; it cannot be corrected with webpage CSS.

## Validation

- All four H.264/AAC files pass strict FFmpeg decoding and have a front-loaded `moov` atom.
- All four sanitized manifests contain 12 authored cues over FACE, BODY, MUSIC, and SPEECH, with no internal filesystem paths.
- Chromium desktop validation used a 1440×1000 viewport; mobile validation used 390×844 with no page-level horizontal overflow.
- The browser loaded four case selectors, four timeline rows, and twelve segments; switching cases changed the video source and cue text.
- All four selected MP4 files advanced under real Chromium playback and reached `readyState = 4`.
- Seeking to 7.5 seconds activated all four expected tracks, and clicking a cue segment sought the video to its authored start.
- With JavaScript disabled, the mobile layout remains visible and has no page-level horizontal overflow.
- No console errors, page errors, or unexpected failed requests were observed.
