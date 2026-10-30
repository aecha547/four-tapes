# Four Tapes, Just for You

A small, private, mobile-friendly collection of four recordings, with a separate opening scene and soundtrack. The complete project uses plain HTML, CSS and JavaScript. There is no build command, font download, account, analytics or external dependency.

## How to open it

Unzip the folder and open `index.html`, keeping `MEMORY.mp3`, `player.js`, `scenes.js`, `style.css` and the entire `media` folder together. For the most consistent results on phones, publish the **whole unzipped folder** on an HTTPS static host that supports MP4 byte-range requests. A ZIP by itself is not a website link.

Opening the page shows a single **Tap to continue** button over the full-screen night scene. Tapping it starts the cutscene, and also unlocks the separate soundtrack for browsers that require a user gesture. No sliding mechanism is used. There is a discreet **Skip opening** control. If a device still blocks audio, the scene continues quietly and offers **Tap to hear the music**.

## The sequence

1. **Tap to continue** starts the full-screen night scene with a firefly and eight brief lines. No tape begins playing. The soundtrack is primed silently during the tap, then becomes audible only at its intended cue.
2. At about **20 seconds** into the opening, the soundtrack is requested from **`MEMORY.mp3` at about 00:08**. Sound gently fades in over about 3.2 seconds. The rest of the dialogue follows the actual soundtrack playback clock so buffering cannot send the scene ahead of the sound.
3. At about **35.4 seconds**, the opening fades into the archive over roughly 1.3 seconds. The scene artwork remains unobstructed by text. If allowed by the browser, `MEMORY.mp3` continues beneath the archive; it has its own pause/play button.
4. **No tape is selected or played automatically.** Choose a cassette or one of the four small dots to start a recording from its beginning. The soundtrack fades out when a tape starts, so the two recordings do not compete. Tape switching, replay, video controls and full-screen video playback remain available.

The soundtrack begins at 00:08 because the original audio has a lead-in. The opening is timed to that offset, not to the beginning of any video. Browsers that still block playback, even after the entry gesture, may require the listener to tap the audio button. An entry tap can bypass autoplay restrictions, but does not solve CORS or missing-file errors.

## Recordings

| Tape | Recording | Source |
| --- | --- | --- |
| 01 | Stars | `media/tape-1.mp4` |
| 02 | Dive | `media/tape-2.mp4` |
| 03 | Whereforth | `media/tape-3.mp4` |
| 04 | Je musique | `media/tape-4.mp4` |

All four original MP4 files are included. The 6-minute-plus `MEMORY.mp3` is included separately and is not used as one of the four tapes.

## Device support

The opening uses the dynamic viewport height when supported, with a fallback for older browsers. The layout adapts to narrow phones, landscape phones and desktop screens, including display notches and home-indicator safe areas. Controls are touch-sized, and keyboard users can activate buttons and skip the opening. The audio uses a Web Audio gain control when available for smooth fades on iPhones, with HTML audio as a fallback. The video keeps native controls and `playsinline` for phones, with iPhone's native full-screen fallback. The scene animations respect reduced-motion settings and pause when the page is hidden.

## Edit the project

- `player.js`: dialogue, music timing, tap-to-enter behavior, selection, media controls and transitions.
- `style.css`: full-screen scene, firefly, cassette layout and responsive rules.
- `scenes.js`: SVG art and procedural animation on the archive screen.
- `index.html`: markup and on-screen copy.

The files work without frameworks or package installs. The `noindex,nofollow,noarchive` robots directive is included for discretion, but **that is not access control**. Use a private/password-protected host if you need actual privacy.
