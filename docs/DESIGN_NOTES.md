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

The MP4s use the audience-only output from the original compositor's default quality path, with a two-second GOP and front-loaded `moov` atoms. They total about 7.1 MB, and the largest case is 3.05 MB. The later 520 kbps / 64 kbps delivery cap was removed because it traded away quality beyond the requested panel extraction. Loading instead benefits from `preload="none"`, one selected player instead of four simultaneous players, the short GOP, and front-loaded MP4 metadata.

The webpage console is generated from the selected case's own manifest. The manifests reproduce the exact source controls: starts and ends are unchanged, and the three authored submission batches enter at 0, 4, and 9 seconds. The red `模型 NOW` line stays at 72% of the usable lane width, matching the upstream compositor. Cards and ruler ticks use the same normalized scale as that renderer: one second equals `52 / 377` of the lane width. The web implementation also ports the renderer's 78-pixel minimum card width, 12-pixel admission slide/fade, partial clipping, eviction fade, and overlapping-event sublane assignment. `requestVideoFrameCallback` supplies the presented frame's media time when the browser supports it; `video.currentTime` is the fallback.

## Evidence boundary

All four manifests state `event_source: "derived"` because the available generation logs contain no compatible `[TC-window]` lifecycle records. Authored admissions still come directly from the exact controls; evictions use the renderer's five-second derived history rule. The webpage therefore labels the timeline as authored/derived and does not describe it as a measured runtime trace. Configuration labels are parsed from the frozen file provenance supplied for this task; the page makes no comparative quality or speed claim.

## Selected cases

| Web label | Source scenario | Source aspect before presentation |
| --- | --- | --- |
| The reveal | elderly woman, thumbs-up/pointing livestream | 832×1472 |
| Kitchen notes | male half-body, home kitchen | 1024×704 |
| Craft in motion | female half-body, pottery studio | 1024×704 |
| Plan, revised | woman, home video call gesture | 1248×704 |

## Shared timing versus per-case content

The four authored control files intentionally share the same twelve interval boundaries. Their anchor descriptions and all per-track prompt text are different. MUSIC and SPEECH both use three contiguous intervals, `[0,5]`, `[5,10]`, and `[10,15]`; adjacent cards therefore meet at their boundaries just as they do in the original compositor. The webpage preserves this common schedule rather than inventing gaps or different timings, while changing every visible prompt when a case is selected.

## Validation

- All four H.264/AAC files pass strict FFmpeg decoding, use a common 406×720 live-room layout, have two-second keyframe spacing, and have a front-loaded `moov` atom.
- All four sanitized manifests contain 12 authored cues over FACE, BODY, MUSIC, and SPEECH, reproduce the exact 0/4/9-second source submission schedule, carry distinct case content, and contain no internal filesystem paths.
- Chromium desktop validation used a 1440×1000 viewport; mobile validation used 390×844 with no page-level horizontal overflow.
- The browser loaded the bundled CJK webfont and rendered Chinese DOM labels without missing glyphs.
- Switching cases changed the live-room video, global anchor, and per-track prompt content without changing the DOM prompt console.
- At 7.5 seconds, the NOW line measured 72% across the lane and all four active packets crossed that coordinate.
- During real playback, the frame-synchronized panel remained within 90 ms of `video.currentTime`.
- With JavaScript disabled, the mobile layout remains visible and has no page-level horizontal overflow.
- No console errors, page errors, or unexpected failed requests were observed.
