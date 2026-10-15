# Four Tapes for Nini

A mobile-first, static video archive with four songs made for Nini.

## Open

Extract the ZIP first, then open `index.html`. Keep every file and the `media` folder together. Drag the yellow slot to the right, or tap its arrow, to start the firefly opening. Once the opening finishes, tap any tape to play it. The four dots also select tapes. Use the video's usual playback controls, Replay, or Fullscreen.

No build step, package installation, account, or internet font connection is required.

## Send her a link

Upload the complete folder to a static website host that serves MP4 files and supports HTTP byte ranges. The site's entry point is `index.html`, with no build command. Once hosted, copy its HTTPS link into your message to her. An extracted local file or localhost address is a preview on your computer; the ZIP itself is not a shareable website link.

## Recordings

1. Stars — `media/tape-1.mp4`
2. Dive — `media/tape-2.mp4`
3. Whereforth — `media/tape-3.mp4`
4. Je musique — `media/tape-4.mp4`

Each full video is included at 960 pixels wide, preserving its original aspect ratio, frame rate, duration, and original AAC audio. Video is optimised for smaller downloads with MP4 fast-start. The audio was copied without re-encoding. The four videos total approximately 85 MB, compared with approximately 684 MB in the originals. Other recordings load only when selected.

## Opening timing

The eight timing slots retained in Nighty's original Minji intro are unchanged:

| Line | Appears at | Hold |
| --- | --- | --- |
| 1 | 2.6 seconds | 2.2 seconds |
| 2 | 5.3 seconds | 3.5 seconds |
| 3 | 9.3 seconds | 3.2 seconds |
| 4 | 13.0 seconds | 2.8 seconds |
| 5 | 16.3 seconds | 3.0 seconds |
| 6 | 19.8 seconds | 3.5 seconds |
| 7 | 23.8 seconds | 3.0 seconds |
| 8 | 27.3 seconds | 3.5 seconds |

Stars is prepared at 16.3 seconds, starts at 19.8 seconds from its 8-second source offset, and fades in over 2.7 seconds. The archive appears at 31.6 seconds; the same media element continues playing without restarting. Tap Stars afterwards to play the complete song from the beginning. The last cues follow the real media clock, so buffering pauses the choreography instead of letting it drift. If a phone requires another playback gesture, the opening shows a simple tap-to-play button. Switching away during the intro pauses its timeline.

## Files and design

`index.html`, `style.css`, `scenes.js`, and `player.js` make up the complete editable site. Wording and tape names are in `player.js` and `index.html`. The tape-rack styling and firefly are adapted from Nighty. The four original SVG scenes, including the bird and growing flower, and their animation code are adapted from the supplied `index (8).html`. The top dots and thin progress line retain the reference style; the line reflects the selected recording's actual playback position.

The site has no branching story, games, scores, tracking, or additional audio processing. Reduced-motion preferences are respected. The page includes `noindex,nofollow,noarchive` for this personal gift.
