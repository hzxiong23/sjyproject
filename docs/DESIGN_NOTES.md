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

## Why one player and a DOM panel

All four selected outputs are 15.041667-second, 406×720 H.264/AAC videos. They preserve the original demo's live-room presentation on the media side: host identity, live/viewer state, follow action, moving danmu, comments, reactions, and the composer are rasterized with the generated frames. A single player with a visual case rail avoids downloading and decoding four videos simultaneously.

The earlier 834×720 composites also baked the prompt cards and timeline into the video. This revision limits rasterized UI to the live-room HUD on the left and keeps the entire prompt console as HTML/CSS on the right. Chinese DOM text uses a 62 KB subset WenQuanYi webfont, so labels remain selectable, editable, resolution-independent, and much faster to load than the previous 3.9 MB font.

The MP4s use a two-second GOP, a 520 kbps VBV ceiling, 64 kbps AAC audio, and front-loaded `moov` atoms. They total about 4.1 MB instead of 26.4 MB, and the largest case is 1.10 MB instead of 17.3 MB. `preload="none"` prevents the browser from consuming that media bandwidth before a visitor chooses to play.

The webpage console is generated from the selected case's own manifest. The red `模型 NOW` line stays at 72% of the usable lane width, matching the upstream compositor. Cards and ruler ticks use the same normalized scale as that renderer: one second equals `52 / 377` of the lane width. `requestVideoFrameCallback` supplies the presented frame's media time when the browser supports it; `video.currentTime` is the fallback.

## Evidence boundary

All four manifests state `event_source: "derived"`. The webpage therefore labels the timeline as authored/derived and does not describe it as a measured runtime trace. Configuration labels are parsed from the frozen file provenance supplied for this task; the page makes no comparative quality or speed claim.

## Selected cases

| Web label | Source scenario | Source aspect before presentation |
| --- | --- | --- |
| The reveal | elderly woman, thumbs-up/pointing livestream | 832×1472 |
| Kitchen notes | male half-body, home kitchen | 1024×704 |
| Craft in motion | female half-body, pottery studio | 1024×704 |
| Plan, revised | woman, home video call gesture | 1248×704 |

## Shared timing versus per-case content

The four authored control files intentionally share the same twelve interval boundaries. Their anchor descriptions and all per-track prompt text are different. The webpage therefore preserves the common schedule rather than inventing different timings, while changing every visible prompt when a case is selected.

## Validation

- All four H.264/AAC files pass strict FFmpeg decoding, use a common 406×720 live-room layout, have two-second keyframe spacing, and have a front-loaded `moov` atom.
- All four sanitized manifests contain 12 authored cues over FACE, BODY, MUSIC, and SPEECH, with distinct case content and no internal filesystem paths.
- Chromium desktop validation used a 1440×1000 viewport; mobile validation used 390×844 with no page-level horizontal overflow.
- The browser loaded the bundled CJK webfont and rendered Chinese DOM labels without missing glyphs.
- Switching cases changed the live-room video, global anchor, and per-track prompt content without changing the DOM prompt console.
- At 7.5 seconds, the NOW line measured 72% across the lane and all four active packets crossed that coordinate.
- During real playback, the frame-synchronized panel remained within 90 ms of `video.currentTime`.
- With JavaScript disabled, the mobile layout remains visible and has no page-level horizontal overflow.
- No console errors, page errors, or unexpected failed requests were observed.
