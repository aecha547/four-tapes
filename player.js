(() => {
 'use strict';
 const tracks = [
  {title:'Stars',file:'media/tape-1.mp4',note:'Some nights, I put what I felt into the sky.'},
  {title:'Dive',file:'media/tape-2.mp4',note:'For the feelings that never stayed near the surface.'},
  {title:'Whereforth',file:'media/tape-3.mp4',note:'For every thought that kept finding its way to you.'},
  {title:'Je musique',file:'media/tape-4.mp4',note:'When the words ran out, there was still this.'}
 ];
 // Original MINJI timing slots, retained by Nighty's Intro.tsx/dialogue.ts.
 const cues = [
  {at:2.6,dur:2.2,text:'there you are, Nini.',ff:[50,43]},
  {at:5.3,dur:3.5,text:'I’ve been keeping a little light for you.',ff:[44,38]},
  {at:9.3,dur:3.2,text:'For the words that arrived too quietly.',ff:[56,40]},
  {at:13.0,dur:2.8,text:'For the nights I wished you were here.',ff:[48,35]},
  {at:16.3,dur:3.0,text:'Four songs. What I couldn’t quite say.',ff:[42,44]},
  {at:19.8,dur:3.5,text:'I made them for you. I hope you can hear it.',ff:[58,38]},
  {at:23.8,dur:3.0,text:'Some feelings only know how to become music.',ff:[52,46]},
  {at:27.3,dur:3.5,text:'Stay a little. The first one is yours.',ff:[47,39]}
 ];
 const MUSIC_AT=19.8,MUSIC_OFFSET=8,PRELOAD_AT=16.3,INTRO_END=31.6;
 const video=$('video'),archive=$('archive'),intro=$('intro'),line=$('introLine');
 const start=$('startBtn'),slot=$('startSlot'),firefly=$('firefly'),message=$('mediaMessage');
 const tapes=[...document.querySelectorAll('[data-tape]')],dots=[...document.querySelectorAll('[data-dot]')];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let mode='cover',selected=0,playToken=0,introFrame=0,cueIndex=-1,clock=0,wallStart=0,musicRequested=false,musicReady=false,prepped=false;
 let lostTime=0,hiddenAt=null;
 function setTrack(i){
  selected=i;
  $('scene-label').textContent=`0${i+1} / ${tracks[i].title.toUpperCase()}`;
  $('playingLabel').textContent=`TAPE 0${i+1} · ${tracks[i].title.toUpperCase()}`;
  tapes.forEach((t,n)=>{t.classList.toggle('active',n===i);t.setAttribute('aria-pressed',String(n===i))});
  dots.forEach((d,n)=>d.setAttribute('aria-pressed',String(n===i)));
  $('rackNote').textContent=tracks[i].note;
  video.setAttribute('aria-label',`Tape ${i+1}: ${tracks[i].title}`);
 }
 function progress(){
  const value=Number.isFinite(video.duration)&&video.duration>0?video.currentTime/video.duration:0;
  $('scene-progress').style.transform=`scaleX(${Math.max(0,Math.min(1,value))})`;
 }
 function clearMessage(){message.hidden=true;message.replaceChildren()}
 function showMessage(text,buttonText,action){
  message.replaceChildren();
  const p=document.createElement('p');p.textContent=text;message.append(p);
  if(buttonText){const b=document.createElement('button');b.type='button';b.textContent=buttonText;b.addEventListener('click',action);message.append(b)}
  message.hidden=false;
 }
 function resumeScene(){if(!reduced.matches&&!document.hidden&&mode!=='player'){SceneMotion.paused=false;BgScenes.start()}}
 function showPlayer(){
  setTrack(selected);
  mode='player';cancelAnimationFrame(introFrame);intro.hidden=true;$('cover').hidden=true;
  archive.classList.remove('intro-running');archive.classList.add('has-media');
  slot.hidden=true;$('playingStrip').hidden=false;$('openingHint').textContent='';
  firefly.hidden=true;video.controls=true;BgScenes.stop();
  $('footerNote').textContent='Whenever you’re ready, choose another.';
  tapes.forEach(t=>t.disabled=false);dots.forEach(d=>d.disabled=false);
  clearMessage();progress();
 }
 async function playCurrent(){
  try{await video.play();return true}catch(e){
   if(e.name==='AbortError')return false;
   if(mode==='intro')$('resumeMusic').hidden=false;
   else showMessage('Your tape is ready.','Tap to play',()=>{clearMessage();playCurrent()});
   return false;
  }
 }
 function selectTape(i){
  if(mode==='intro')return;
  if(mode==='cover'){beginIntro();return}
  const token=++playToken;video.pause();clearMessage();setTrack(i);showPlayer();
  video.src=tracks[i].file;video.preload='metadata';video.load();
  progress();
  video.play().catch(e=>{if(token!==playToken||e.name==='AbortError')return;if(video.error)return;showMessage('Your tape is ready.','Tap to play',()=>{clearMessage();playCurrent()})});
 }
 function startIntroMusic(){
  musicRequested=true;
  const launch=()=>{
   if(mode!=='intro')return;
   video.pause();video.volume=0;video.muted=false;
   const play=()=>{
    if(mode!=='intro')return;
    video.play().then(()=>{if(mode==='intro'){musicReady=true;$('resumeMusic').hidden=true}}).catch(()=>{$('resumeMusic').hidden=false});
   };
   if(Math.abs(video.currentTime-MUSIC_OFFSET)<.05&&!video.seeking)play();
   else{video.addEventListener('seeked',play,{once:true});video.currentTime=MUSIC_OFFSET}
  };
  if(video.readyState>=1)launch();else video.addEventListener('loadedmetadata',launch,{once:true});
 }
 function tickIntro(now){
  if(mode!=='intro')return;
  const wall=(now-wallStart-lostTime)/1000;
  if(!prepped&&wall>=PRELOAD_AT){
   prepped=true;video.preload='auto';
   const prepare=()=>{if(mode==='intro'&&!musicRequested)video.currentTime=MUSIC_OFFSET};
   if(video.readyState>=1)prepare();else video.addEventListener('loadedmetadata',prepare,{once:true});
  }
  if(!musicRequested&&wall>=MUSIC_AT)startIntroMusic();
  // Music owns the final cues: buffering cannot move the words ahead of the song.
  clock=musicReady?MUSIC_AT+Math.max(0,video.currentTime-MUSIC_OFFSET):musicRequested?MUSIC_AT:Math.min(wall,MUSIC_AT);
  if(musicReady)video.volume=Math.max(0,Math.min(1,(video.currentTime-MUSIC_OFFSET)/2.7));
  let index=-1,visible=false;
  cues.forEach((cue,i)=>{if(clock>=cue.at){index=i;visible=clock<cue.at+cue.dur}});
  if(index!==cueIndex){
   cueIndex=index;
   if(index>=0){line.textContent=cues[index].text;firefly.style.left=cues[index].ff[0]+'%';firefly.style.top=cues[index].ff[1]+'%'}
  }
  line.classList.toggle('visible',visible);
  if(clock>=INTRO_END){showPlayer();video.focus({preventScroll:true});return}
  introFrame=requestAnimationFrame(tickIntro);
 }
 function beginIntro(){
  if(mode!=='cover')return;
  mode='intro';wallStart=performance.now();clock=0;lostTime=0;start.disabled=true;
  tapes.forEach(t=>t.disabled=true);dots.forEach(d=>d.disabled=true);
  archive.classList.add('intro-running');$('cover').hidden=true;intro.hidden=false;
  firefly.style.left='50%';firefly.style.top='43%';
  $('openingHint').textContent='A little light is finding its way to you.';
  video.controls=false;video.src=tracks[0].file;video.preload='auto';video.volume=0;video.muted=false;
  // Authorise this exact media element inside the opening tap/drag gesture on mobile.
  video.play().then(()=>{if(mode==='intro'&&!musicRequested){video.pause();video.currentTime=0}}).catch(()=>{});
  introFrame=requestAnimationFrame(tickIntro);
 }
 $('resumeMusic').addEventListener('click',()=>{video.volume=1;video.muted=false;video.play().then(()=>{musicReady=true;$('resumeMusic').hidden=true}).catch(()=>{})});
 video.addEventListener('error',()=>{
  if(mode==='intro'){showPlayer();showMessage('This recording couldn’t open. Try it once more.','Retry tape',()=>selectTape(0))}
  else showMessage('This recording couldn’t open. Try it once more.','Retry tape',()=>selectTape(selected));
 });
 video.addEventListener('playing',()=>{archive.classList.add('is-playing');if(mode==='player')clearMessage()});
 video.addEventListener('pause',()=>archive.classList.remove('is-playing'));
 video.addEventListener('timeupdate',progress);video.addEventListener('durationchange',progress);video.addEventListener('seeked',progress);
 video.addEventListener('ended',()=>{
  archive.classList.remove('is-playing');
  $('rackNote').textContent=selected===3?'All four were made for you. Come back whenever you like.':'Stay a little longer, if you like. There’s another tape waiting.';
  progress();
 });
 tapes.forEach(t=>t.addEventListener('click',()=>selectTape(Number(t.dataset.tape))));
 dots.forEach(d=>d.addEventListener('click',()=>selectTape(Number(d.dataset.dot))));
 $('replayBtn').addEventListener('click',()=>{video.currentTime=0;clearMessage();playCurrent()});
 $('fullscreenBtn').addEventListener('click',()=>{
  // iPhone exposes a video-specific fullscreen entry point.
  if(typeof video.webkitEnterFullscreen==='function'){try{video.webkitEnterFullscreen();return}catch{}}
  if(video.requestFullscreen)video.requestFullscreen().catch(()=>{});
  else if(video.webkitRequestFullscreen)video.webkitRequestFullscreen();
 });
 let drag=null,suppressClick=false;
 start.addEventListener('pointerdown',e=>{
  if(mode!=='cover'||e.button!==0)return;
  drag={x:e.clientX,value:0,moved:false};start.setPointerCapture(e.pointerId);
 });
 start.addEventListener('pointermove',e=>{
  if(!drag)return;
  const max=Math.max(1,slot.clientWidth-start.offsetWidth-8);
  drag.value=Math.max(0,Math.min(max,e.clientX-drag.x));drag.moved ||= Math.abs(e.clientX-drag.x)>6;
  start.style.transform=`translateX(${drag.value}px)`;$('slotFill').style.transform=`scaleX(${drag.value/max})`;
  $('slotPrompt').style.opacity=String(1-drag.value/max*.8);
 });
 start.addEventListener('pointerup',e=>{
  if(!drag)return;
  const max=Math.max(1,slot.clientWidth-start.offsetWidth-8),complete=drag.value/max>.85,moved=drag.moved;
  drag=null;start.releasePointerCapture(e.pointerId);
  suppressClick=moved;
  if(complete){beginIntro();return}
  start.style.transform='';$('slotFill').style.transform='scaleX(0)';$('slotPrompt').style.opacity='1';
 });
 start.addEventListener('pointercancel',()=>{drag=null;start.style.transform='';$('slotFill').style.transform='scaleX(0)';$('slotPrompt').style.opacity='1'});
 start.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return}beginIntro()});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
   hiddenAt=performance.now();SceneMotion.stop();
   if(mode==='intro'){video.pause();cancelAnimationFrame(introFrame)}
  }else{
   if(mode==='intro'){
    if(hiddenAt!==null)lostTime+=performance.now()-hiddenAt;
    if(musicReady)video.play().catch(()=>{$('resumeMusic').hidden=false});
    introFrame=requestAnimationFrame(tickIntro);
   }
   resumeScene();hiddenAt=null;
  }
 });
 const setReduced=()=>{SceneMotion.paused=reduced.matches;if(reduced.matches){SceneMotion.stop();BgScenes.show(BgScenes.current)}else resumeScene()};
 reduced.addEventListener?.('change',setReduced);
 BgScenes.init();setReduced();resumeScene();
 // Every tape remains directly available once the opening has finished.
 tapes.forEach(t=>t.setAttribute('aria-pressed','false'));
})();
