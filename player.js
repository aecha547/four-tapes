(() => {
  'use strict';

  const tracks = [
    { title: 'Stars', file: 'media/tape-1.mp4', note: 'Some nights, I put what I felt into the sky.' },
    { title: 'Dive', file: 'media/tape-2.mp4', note: 'For the feelings that never stayed near the surface.' },
    { title: 'Whereforth', file: 'media/tape-3.mp4', note: 'For every thought that kept finding its way back to you.' },
    { title: 'Je musique', file: 'media/tape-4.mp4', note: 'When I ran out of words, I still had this.' }
  ];

  // Seconds after the opening begins. The last lines follow MEMORY.mp3's playback
  // position, not wall-clock time, so a slow network cannot outrun the music.
  const cues = [
    { at: 2.5,  dur: 2.9, text: 'Hey, you.', ff: [50, 35] },
    { at: 6.1,  dur: 3.2, text: 'I wanted to show you something.', ff: [42, 40] },
    { at: 10.1, dur: 3.3, text: 'I kept trying to find the right words.', ff: [56, 34] },
    { at: 14.3, dur: 3.0, text: 'But they never came out quite right.', ff: [47, 39] },
    { at: 18.1, dur: 3.1, text: 'So I made something instead.', ff: [53, 33] },
    { at: 22.3, dur: 3.4, text: 'Four little songs. All for you.', ff: [43, 39] },
    { at: 26.8, dur: 3.4, text: 'There’s no rush to listen.', ff: [57, 36] },
    { at: 31.2, dur: 3.1, text: 'Just stay here for a moment.', ff: [50, 32] }
  ];
  const MUSIC_AT = 20.0;
  const MUSIC_OFFSET = 8.0;
  const INTRO_END = 35.4;
  const MAX_MEMORY_VOLUME = .82;
  const $ = id => document.getElementById(id);
  const archive = $('archive'), intro = $('intro'), introLine = $('introLine');
  const video = $('video'), memory = $('memoryAudio');
  const start = $('startBtn'), slot = $('startSlot'), firefly = $('firefly');
  const message = $('mediaMessage'), tapes = [...document.querySelectorAll('[data-tape]')];
  const dots = [...document.querySelectorAll('[data-dot]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let mode = 'cover'; // cover -> intro -> ready -> player
  let selected = -1, playToken = 0;
  let introFrame = 0, cueIndex = -1, introClock = 0, wallStart = 0, hiddenAt = null, lostTime = 0;
  let musicRequested = false, musicStarted = false, silent = false, silentStart = 0;
  let audioContext = null, gainNode = null, memoryLevel = 0, fadeFrame = 0;
  let transitionTimer = 0;

  const clamp = value => Math.max(0, Math.min(1, value));
  const visibleTime = () => (performance.now() - wallStart - lostTime) / 1000;

  function setTrack(index) {
    selected = index;
    const hasTrack = index >= 0;
    $('scene-label').textContent = hasTrack ? `0${index + 1} / ${tracks[index].title.toUpperCase()}` : 'YOUR FOUR TAPES';
    $('playingLabel').textContent = hasTrack ? `TAPE 0${index + 1} · ${tracks[index].title.toUpperCase()}` : '';
    tapes.forEach((t, i) => {
      t.classList.toggle('active', hasTrack && i === index);
      t.setAttribute('aria-pressed', String(hasTrack && i === index));
    });
    dots.forEach((d, i) => d.setAttribute('aria-pressed', String(hasTrack && i === index)));
    $('rackNote').textContent = hasTrack ? tracks[index].note : 'Take your time. These were always meant for you.';
    video.setAttribute('aria-label', hasTrack ? `Tape ${index + 1}: ${tracks[index].title}` : 'Video player');
    document.documentElement.style.setProperty('--scene-rgb', BgScenes.colors[hasTrack ? index : BgScenes.current]);
  }

  function progress() {
    const ratio = mode === 'player' && Number.isFinite(video.duration) && video.duration > 0
      ? clamp(video.currentTime / video.duration) : 0;
    $('scene-progress').style.transform = `scaleX(${ratio})`;
  }

  function clearMessage() {
    message.hidden = true;
    message.replaceChildren();
  }

  function showMessage(text, actionLabel, action) {
    message.replaceChildren();
    const p = document.createElement('p');
    p.textContent = text;
    message.append(p);
    if (actionLabel) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = actionLabel;
      button.addEventListener('click', action, { once: true });
      message.append(button);
    }
    message.hidden = false;
  }

  // A Web Audio gain node makes fades work on iOS, which ignores element.volume.
  // The ordinary audio element is the fallback when Web Audio is unavailable.
  function prepareSound() {
    if (audioContext) {
      audioContext.resume().catch(() => {});
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(memory);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
      audioContext = ctx;
      gainNode = gain;
      memory.volume = 1;
      ctx.resume().catch(() => {});
    } catch (error) {
      // Element playback still works when an AudioContext cannot be created.
      gainNode = null;
      audioContext = null;
      memory.volume = 0;
    }
  }

  function setMemoryVolume(level) {
    memoryLevel = clamp(level);
    if (gainNode && audioContext) gainNode.gain.setValueAtTime(memoryLevel, audioContext.currentTime);
    else memory.volume = memoryLevel;
  }

  function fadeMemory(target, duration, done) {
    cancelAnimationFrame(fadeFrame);
    const from = memoryLevel;
    const startAt = performance.now();
    const smooth = x => x * x * (3 - 2 * x);
    if (duration === 0 || reduced.matches) {
      setMemoryVolume(target);
      done?.();
      return;
    }
    const frame = now => {
      const fraction = clamp((now - startAt) / duration);
      setMemoryVolume(from + (target - from) * smooth(fraction));
      if (fraction < 1) fadeFrame = requestAnimationFrame(frame);
      else done?.();
    };
    fadeFrame = requestAnimationFrame(frame);
  }

  function primeMemory() {
    prepareSound();
    memory.preload = 'auto';
    memory.load();
    // The opening gesture makes subsequent playback possible on more mobile browsers.
    // Nothing is audible and the element is paused before the scene's music cue.
    setMemoryVolume(0);
    memory.play().then(() => {
      if (mode === 'intro' && !musicRequested) {
        memory.pause();
        try { memory.currentTime = MUSIC_OFFSET; } catch (_) { /* metadata not ready yet */ }
      }
    }).catch(() => {});
  }

  memory.addEventListener('loadedmetadata', () => {
    if (!musicStarted) {
      try { memory.currentTime = MUSIC_OFFSET; } catch (_) { /* seek at playback time */ }
    }
  });

  function updateMemoryUI() {
    const playing = !memory.paused && !memory.ended && !memory.error;
    $('memoryStatus').textContent = playing ? 'MEMORY IS PLAYING' : memory.error ? 'MUSIC UNAVAILABLE' : 'MEMORY IS PAUSED';
    $('memoryToggle').textContent = playing ? 'Pause music' : memory.ended ? 'Replay music' : 'Play music';
    $('memoryToggle').setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
    $('memoryStrip').classList.toggle('music-paused', !playing);
  }

  async function playMemory() {
    if (memory.error) { updateMemoryUI(); return false; }
    if (memory.ended || (Number.isFinite(memory.duration) && memory.currentTime >= memory.duration - .5)) {
      try { memory.currentTime = MUSIC_OFFSET; } catch (_) { /* wait for metadata */ }
    }
    if (audioContext && audioContext.state !== 'running') audioContext.resume().catch(() => {});
    try {
      await memory.play();
      musicStarted = true;
      $('resumeMusic').hidden = true;
      $('silentContinue').hidden = true;
      fadeMemory(MAX_MEMORY_VOLUME, mode === 'intro' ? 3200 : 850);
      updateMemoryUI();
      return true;
    } catch (_) {
      if (mode === 'intro') {
        $('resumeMusic').hidden = false;
        $('silentContinue').hidden = false;
      }
      updateMemoryUI();
      return false;
    }
  }

  function requestMemory() {
    if (musicRequested) return;
    musicRequested = true;
    const launch = () => {
      if (mode !== 'intro' && mode !== 'ready') return;
      // The opening has its own soundtrack, separate from the video tapes.
      if (!musicStarted) {
        try { memory.currentTime = MUSIC_OFFSET; } catch (_) { /* handled by fallback */ }
      }
      playMemory();
    };
    if (memory.readyState >= HTMLMediaElement.HAVE_METADATA) launch();
    else memory.addEventListener('loadedmetadata', launch, { once: true });
  }

  function showReady() {
    if (mode === 'ready' || mode === 'player') return;
    mode = 'ready';
    cancelAnimationFrame(introFrame);
    introLine.classList.remove('visible');
    $('coverEyebrow').textContent = 'TAKE YOUR TIME';
    $('coverTitle').textContent = 'They’re here when you’re ready.';
    $('coverSubtitle').textContent = 'Pick whichever song you want to hear first.';
    $('cover').classList.add('archive-invite');
    $('cover').hidden = false;
    $('startSlot').hidden = true;
    $('playingStrip').hidden = true;
    $('memoryStrip').hidden = false;
    $('openingHint').hidden = true;
    $('footerNote').textContent = 'Listen in any order. Nothing starts until you choose.';
    archive.classList.remove('intro-running', 'has-media', 'is-playing');
    document.body.classList.remove('intro-active');
    // A landscape phone may have scrolled to the start handle; reveal from the top.
    window.scrollTo(0, 0);
    document.body.classList.add('intro-exiting');
    intro.classList.add('is-ending');
    archive.inert = false;
    archive.removeAttribute('aria-hidden');
    video.controls = false;
    setTrack(-1);
    updateMemoryUI();
    if (!reduced.matches) { SceneMotion.paused = false; BgScenes.start(); }
    clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      intro.hidden = true;
      intro.classList.remove('is-ending');
      document.body.classList.remove('intro-exiting');
      $('memoryToggle').focus({ preventScroll: true });
    }, reduced.matches ? 0 : 1350);
  }

  function tickIntro(now) {
    if (mode !== 'intro') return;
    const wall = (now - wallStart - lostTime) / 1000;
    if (!musicRequested && wall >= MUSIC_AT) requestMemory();
    if (silent) introClock = MUSIC_AT + Math.max(0, wall - silentStart);
    else if (musicStarted) introClock = MUSIC_AT + Math.max(0, memory.currentTime - MUSIC_OFFSET);
    else introClock = Math.min(wall, MUSIC_AT);

    let nextIndex = -1, shouldShow = false;
    cues.forEach((cue, index) => {
      if (introClock >= cue.at) {
        nextIndex = index;
        shouldShow = introClock < cue.at + cue.dur;
      }
    });
    if (nextIndex !== cueIndex) {
      cueIndex = nextIndex;
      if (nextIndex >= 0) {
        introLine.textContent = cues[nextIndex].text;
        firefly.style.left = `${cues[nextIndex].ff[0]}%`;
        firefly.style.top = `${cues[nextIndex].ff[1]}%`;
      }
    }
    introLine.classList.toggle('visible', shouldShow);
    $('introProgress').style.transform = `scaleX(${clamp(introClock / INTRO_END)})`;
    if (introClock >= INTRO_END) { showReady(); return; }
    introFrame = requestAnimationFrame(tickIntro);
  }

  function beginIntro() {
    if (mode !== 'cover') return;
    mode = 'intro';
    archive.inert = true;
    archive.setAttribute('aria-hidden', 'true');
    document.body.classList.add('intro-active');
    archive.classList.add('intro-running');
    intro.hidden = false;
    intro.classList.remove('is-ending');
    $('introProgress').style.transform = 'scaleX(0)';
    start.disabled = true;
    wallStart = performance.now();
    lostTime = 0;
    introClock = 0;
    cueIndex = -1;
    musicRequested = false;
    musicStarted = false;
    silent = false;
    firefly.style.left = '50%';
    firefly.style.top = '37%';
    BgScenes.stop();
    primeMemory();
    $('skipIntro').focus({ preventScroll: true });
    introFrame = requestAnimationFrame(tickIntro);
  }

  function pauseMemoryForTape() {
    cancelAnimationFrame(fadeFrame);
    const token = ++playToken;
    if (!memory.paused) {
      fadeMemory(0, 450, () => {
        if (token === playToken) { memory.pause(); updateMemoryUI(); }
      });
    }
    return token;
  }

  function showPlayer(index) {
    mode = 'player';
    setTrack(index);
    archive.classList.add('has-media');
    archive.classList.remove('intro-running');
    $('cover').hidden = true;
    $('startSlot').hidden = true;
    $('memoryStrip').hidden = true;
    $('playingStrip').hidden = false;
    $('openingHint').hidden = true;
    video.controls = true;
    BgScenes.stop();
    $('footerNote').textContent = 'You can return to the other songs whenever you like.';
    clearMessage();
    progress();
  }

  function playCurrent() {
    return video.play().catch(error => {
      if (error.name === 'AbortError') return;
      if (!video.error) showMessage('Your recording is ready.', 'Tap to play', () => { clearMessage(); playCurrent(); });
    });
  }

  function selectTape(index) {
    if (mode === 'intro' || mode === 'cover') return;
    if (!Number.isInteger(index) || index < 0 || index >= tracks.length) return;
    const token = pauseMemoryForTape();
    video.pause();
    showPlayer(index);
    // A new click is always a fresh recording, never the 8-second intro offset.
    video.src = tracks[index].file;
    video.preload = 'metadata';
    video.load();
    video.play().catch(error => {
      if (token !== playToken || error.name === 'AbortError' || video.error) return;
      showMessage('Your recording is ready.', 'Tap to play', () => { clearMessage(); playCurrent(); });
    });
  }

  $('resumeMusic').addEventListener('click', () => {
    prepareSound();
    playMemory();
  });
  $('silentContinue').addEventListener('click', () => {
    silent = true;
    silentStart = visibleTime();
    $('resumeMusic').hidden = true;
    $('silentContinue').hidden = true;
  });
  $('skipIntro').addEventListener('click', () => {
    if (mode !== 'intro') return;
    if (!musicRequested) requestMemory();
    showReady();
  });
  $('memoryToggle').addEventListener('click', () => {
    if (mode !== 'ready') return;
    if (!memory.paused && !memory.ended) {
      cancelAnimationFrame(fadeFrame);
      fadeMemory(0, 350, () => { if (mode === 'ready') memory.pause(); updateMemoryUI(); });
    } else {
      prepareSound();
      setMemoryVolume(0);
      playMemory();
    }
  });
  memory.addEventListener('error', () => {
    if (mode === 'intro') {
      $('resumeMusic').hidden = true;
      $('silentContinue').hidden = false;
    }
    updateMemoryUI();
  });
  memory.addEventListener('ended', updateMemoryUI);
  memory.addEventListener('play', updateMemoryUI);
  memory.addEventListener('pause', updateMemoryUI);

  video.addEventListener('error', () => {
    if (mode !== 'player') return;
    showMessage('This recording could not open. Please try again.', 'Retry', () => selectTape(selected));
  });
  video.addEventListener('playing', () => {
    if (mode !== 'player') return;
    archive.classList.add('is-playing');
    clearMessage();
  });
  video.addEventListener('pause', () => archive.classList.remove('is-playing'));
  video.addEventListener('ended', () => {
    archive.classList.remove('is-playing');
    $('rackNote').textContent = selected === 3
      ? 'That’s all four. You can come back to any of them.'
      : 'Listen again, or choose another. It’s up to you.';
    progress();
  });
  ['timeupdate', 'durationchange', 'seeked'].forEach(event => video.addEventListener(event, progress));

  tapes.forEach(t => t.addEventListener('click', () => selectTape(Number(t.dataset.tape))));
  dots.forEach(d => d.addEventListener('click', () => selectTape(Number(d.dataset.dot))));
  $('replayBtn').addEventListener('click', () => {
    if (mode !== 'player') return;
    video.currentTime = 0;
    clearMessage();
    playCurrent();
  });
  $('fullscreenBtn').addEventListener('click', () => {
    if (mode !== 'player') return;
    if (typeof video.webkitEnterFullscreen === 'function') {
      try { video.webkitEnterFullscreen(); return; } catch (_) { /* standard path */ }
    }
    if (video.requestFullscreen) video.requestFullscreen().catch(() => {});
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
  });

  let drag = null, suppressClick = false;
  function resetDrag() {
    drag = null;
    start.style.transform = '';
    $('slotFill').style.transform = 'scaleX(0)';
    $('slotPrompt').style.opacity = '1';
  }
  start.addEventListener('pointerdown', event => {
    if (mode !== 'cover' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { id: event.pointerId, x: event.clientX, value: 0, moved: false };
    start.setPointerCapture(event.pointerId);
  });
  start.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const max = Math.max(1, slot.clientWidth - start.offsetWidth - 8);
    drag.value = Math.max(0, Math.min(max, event.clientX - drag.x));
    drag.moved ||= Math.abs(event.clientX - drag.x) > 7;
    start.style.transform = `translateX(${drag.value}px)`;
    $('slotFill').style.transform = `scaleX(${drag.value / max})`;
    $('slotPrompt').style.opacity = String(1 - drag.value / max * .85);
  });
  start.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const completed = drag.value / Math.max(1, slot.clientWidth - start.offsetWidth - 8) > .8;
    const moved = drag.moved;
    if (start.hasPointerCapture(event.pointerId)) start.releasePointerCapture(event.pointerId);
    resetDrag();
    suppressClick = moved;
    if (completed) beginIntro();
    // The browser's synthetic click follows pointerup in the same turn.
    setTimeout(() => { suppressClick = false; }, 0);
  });
  start.addEventListener('pointercancel', resetDrag);
  start.addEventListener('click', () => {
    if (!suppressClick) beginIntro();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mode === 'intro') {
      event.preventDefault();
      if (!musicRequested) requestMemory();
      showReady();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      SceneMotion.stop();
      if (mode === 'intro') {
        cancelAnimationFrame(introFrame);
        if (!memory.paused) memory.pause();
      } else if (mode === 'ready') {
        if (!memory.paused) memory.pause();
        updateMemoryUI();
      }
    } else {
      if (mode === 'intro') {
        if (hiddenAt !== null) lostTime += performance.now() - hiddenAt;
        if (musicStarted && !silent) playMemory();
        introFrame = requestAnimationFrame(tickIntro);
      } else if (!reduced.matches && mode === 'ready') {
        SceneMotion.paused = false;
        BgScenes.start();
      }
      hiddenAt = null;
    }
  });
  window.addEventListener('pagehide', () => {
    memory.pause();
    video.pause();
  });
  function setReducedMotion() {
    SceneMotion.paused = reduced.matches;
    if (reduced.matches) {
      SceneMotion.stop();
      BgScenes.show(BgScenes.current);
    } else if (mode === 'cover' || mode === 'ready') {
      SceneMotion.paused = false;
      BgScenes.start();
    }
  }
  reduced.addEventListener?.('change', setReducedMotion);

  BgScenes.init();
  setReducedMotion();
  setTrack(-1);
  updateMemoryUI();
})();
