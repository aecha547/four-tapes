const $=id=>document.getElementById(id);
const lerp=(a,b,t)=>a+(b-a)*t;
// Keep the reference movement cadence without inferring a beat from the new songs.
const Snd={on:false,analyser:null};
const MusicSync={beats:t=>t/(60/129.19921875),phase(t=0,beats=1,offset=0){const p=(this.beats(t)+offset)/beats;return ((p%1)+1)%1},pulse(t=0){const p=this.phase(t),d=Math.min(p,1-p);return Math.exp(-d*11)},barPulse(t=0){const p=this.phase(t,4),d=Math.min(p,1-p);return Math.exp(-d*15)}};
const SceneMotion={
  raf:0,last:0,time:0,ages:[0,0,0,0],paused:false,ready:false,
  ns:'http://www.w3.org/2000/svg',cache:new Map(),props:new WeakMap(),
  svg(tag,attrs,parent){const e=document.createElementNS(this.ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(parent)parent.appendChild(e);return e},
  el(id){if(!this.cache.has(id))this.cache.set(id,document.getElementById(id));return this.cache.get(id)},
  attr(e,k,v){if(e)e.setAttribute(k,typeof v==='number'?v.toFixed(3):v)},
  transform(e,v){this.attr(e,'transform',v)},
  base(e,v){this.transform(e,(this.props.get(e)?.transform||'')+' '+v)},
  opacity(e,v){this.attr(e,'opacity',Math.max(0,Math.min(1,v)))},
  smooth(v){v=Math.max(0,Math.min(1,v));return v*v*v*(v*(v*6-15)+10)},
  phase(t,d,i=0){return ((t/d+i*.173)%1+1)%1},
  // Analytic two-bone IK: fixed bone lengths, one shared endpoint per joint.
  joint(a,b,l1,l2,side=1){
    let dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||.001;
    const reach=Math.min(l1+l2-.01,Math.max(Math.abs(l1-l2)+.01,d));
    const end=[a[0]+dx/d*reach,a[1]+dy/d*reach];dx=end[0]-a[0];dy=end[1]-a[1];d=reach;
    const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
    return {k:[a[0]+dx/d*along-dy/d*height*side,a[1]+dy/d*along+dx/d*height*side],end};
  },
  limb(e,a,b,l1,l2,side=1){const j=this.joint(a,b,l1,l2,side);this.attr(e,'d',`M${a} L${j.k} L${j.end}`);return j.end},
  pathInstead(id){const old=this.el(id),e=this.svg('path',{});for(const a of old.attributes)if(!['x1','x2','y1','y2'].includes(a.name))e.setAttribute(a.name,a.value);e.setAttribute('fill','none');e.setAttribute('stroke-linejoin','round');old.replaceWith(e);this.cache.set(id,e);return e},
  init(){
    if(this.ready)return;this.ready=true;
    this.scenes=[...document.querySelectorAll('.bg-scene')];
    this.scenes[1].querySelectorAll('.cloud').forEach((g,i)=>{
      g.innerHTML=`<path d="M-36 6 Q-43 -1 -33 -7 Q-25 -13 -18 -9 C-16 -30 15 -34 21 -13 Q42 -17 43 -2 Q55 3 43 10 Q7 17 -36 6Z" fill="#d4b7d0" opacity="${.11-i*.009}"/><path d="M-24 -8 Q-16 -11 -14 -17 M-6 -24 Q9 -29 17 -15" stroke="#ffe5d5" stroke-width=".6" fill="none" opacity=".09"/>`;
    });
    this.scenes.forEach(s=>s.querySelectorAll('svg *').forEach(e=>this.props.set(e,{transform:e.getAttribute('transform')||'',opacity:Number(e.getAttribute('opacity')||1),x:Number(e.getAttribute('cx')||0),y:Number(e.getAttribute('cy')||0)})));
    this.items=this.scenes.map(s=>{const classes={};s.querySelectorAll('[class]').forEach(e=>e.classList.forEach(c=>(classes[c]??=[]).push(e)));return classes});
    // The stage shadow is in world space. Rotating the body around its supporting
    // toe keeps the toe exactly on the floor throughout every pose.
    const dancer=this.el('ballet-dancer'),shadow=this.el('b-shadow');
    dancer.parentNode.insertBefore(shadow,dancer);this.attr(shadow,'cx',192);this.attr(shadow,'cy',223);this.attr(shadow,'fill','#e6a9c0');this.opacity(shadow,.09);
    this.pathInstead('b-leg-ext-line');
    const stand=this.el('b-leg-stand');stand.querySelector('line').setAttribute('x2','-8');
    this.attr(this.el('b-foot-ext'),'rx',6);
    for(const id of ['jw-leg-l','jw-leg-r','jw-arm-l','jw-arm-r'])this.pathInstead(id);
    this.el('jw-staff').remove(); // An ungripped sliding stick broke ground contact.
    this.road=this.scenes[1].querySelector('.path');this.roadLength=this.road.getTotalLength();
    // Reparent the flower into the stem's coordinate system. No independently
    // scaling stem sections or unattached flower at a fixed world position.
    const stem=this.scenes[3].querySelector('.main-stem');this.plant=stem.parentNode;
    // A perfectly vertical path has zero bbox width: an objectBoundingBox
    // gradient would disappear. Use an explicit stroke for the structural stem.
    stem.innerHTML='<path d="M0 0 C0 -40 0 -80 0 -125" stroke="#83bd70" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M-1 0 V-125" stroke="#c7e8a6" stroke-opacity=".25" stroke-width=".65" fill="none"/>';
    this.flower=this.scenes[3].querySelector('.flower-petals').parentNode;
    this.transform(this.flower,'translate(0 -125)');this.plant.appendChild(this.flower);
    this.scenes[3].querySelector('rect[height="180"]').setAttribute('height','205');
    this.roots=this.scenes[3].querySelector('.roots');
    this.rootPaths=[...this.roots.querySelectorAll('path')];this.rootPaths.forEach(e=>{e.setAttribute('pathLength','1');e.setAttribute('stroke-dasharray','1');e.setAttribute('stroke','#b28a57');e.setAttribute('opacity','.65')});
    // Move feather veins into the corresponding wing; no lines left hanging
    // in the air while the wings articulate about their shoulders.
    const bird=this.el('bird-main');bird.querySelector(':scope > ellipse').remove();
    const veins=[...bird.querySelectorAll(':scope > path:not([id])')];
    ['bird-wing-top','bird-wing-bot'].forEach((id,i)=>{const wing=this.el(id),g=this.svg('g',{id:id+'-rig'});wing.replaceWith(g);g.appendChild(wing);if(veins[i])g.appendChild(veins[i]);this.cache.set(id+'-rig',g)});
    this.decorate();
    this.render(0,6);this.render(1,15);this.render(2,6);this.render(3,10);
    this.start();
  },
  decorate(){
    const ballet=this.scenes[0].querySelector('svg'),dancer=this.el('ballet-dancer');
    const beams=this.svg('g',{opacity:'.35'});ballet.insertBefore(beams,dancer);
    this.beams=[90,200,310].map((x,i)=>this.svg('path',{d:`M${x-3} 14 L${x+3} 14 L${250+i*18} 224 Q200 242 ${130+i*18} 224 Z`,fill:'url(#spotGrad)'},beams));
    const floor=this.svg('g',{stroke:'#e9b7b0','stroke-width':'.55',opacity:'.12'});ballet.insertBefore(floor,dancer);
    for(let i=0;i<10;i++)this.svg('path',{d:`M${200+(i-4.5)*13} 221 L${200+(i-4.5)*70} 300`},floor);
    [233,253,285].forEach(y=>this.svg('path',{d:`M0 ${y} H400`},floor));
    const seed=this.scenes[3].querySelector('svg');
    this.fireflies=Array.from({length:16},(_,i)=>this.svg('circle',{r:i%3===0?1.4:.7,fill:i%2?'#c5efb2':'#f6dc85',opacity:0},seed));
    this.dew=this.svg('circle',{cx:0,cy:0,r:1.8,fill:'#daf6ed',opacity:'.8'},this.plant.querySelector('.leaves'));
    this.ripples=Array.from({length:4},()=>this.svg('ellipse',{cx:0,cy:201,rx:0,ry:0,stroke:'#94bbc1','stroke-width':'.6',fill:'none',opacity:0},seed));
    const flight=this.scenes[2].querySelector('svg');
    this.thermals=Array.from({length:3},(_,i)=>this.svg('path',{d:`M-40 ${170+i*28} Q90 ${115+i*30} 210 ${175+i*20} T460 ${155+i*28}`,stroke:'#d7b4cf','stroke-width':'.6',fill:'none',opacity:'.08'},flight));
    this.noteTrail=Array.from({length:8},()=>this.svg('circle',{r:1,fill:'#ffcedf',opacity:0},ballet));
  },
  start(){if(this.raf||this.paused||document.hidden)return;this.last=performance.now();this.raf=requestAnimationFrame(n=>this.tick(n))},
  stop(){cancelAnimationFrame(this.raf);this.raf=0;this.last=0},
  tick(now){
    this.raf=0;if(this.paused||document.hidden)return;
    const dt=Math.min((now-this.last)/1000,.05);this.last=now;this.time+=dt;
    if(BgScenes.active){
      BgScenes.elapsed+=dt*1000;
      if(BgScenes.elapsed>=BgScenes.duration)BgScenes.next();
      this.ages[BgScenes.current]+=dt;this.render(BgScenes.current,this.ages[BgScenes.current]);
      // The top progress line follows the actual tape media clock.
      const x=lerp(this.px||0,this.targetX||0,1-Math.exp(-dt*3)),y=lerp(this.py||0,this.targetY||0,1-Math.exp(-dt*3));this.px=x;this.py=y;
      document.documentElement.style.setProperty('--motion-x',x.toFixed(2)+'px');document.documentElement.style.setProperty('--motion-y',y.toFixed(2)+'px');
    }
    if(Snd.analyser&&Snd.on){Snd.analyser.getByteFrequencyData(Snd.bins);const energy=Snd.bins.slice(1,12).reduce((a,b)=>a+b,0)/(11*255);Snd.energy=energy;document.documentElement.style.setProperty('--scene-energy',energy.toFixed(3))}
    else Snd.energy=0;
    this.raf=requestAnimationFrame(n=>this.tick(n));
  },
  each(scene,c,fn){(this.items[scene][c]||[]).forEach(fn)},
  render(scene,t){
    const set=(e,v)=>this.transform(e,v),base=(e,v)=>this.base(e,v),op=(e,v)=>this.opacity(e,v),each=(c,fn)=>this.each(scene,c,fn);
    // Every repeating object crosses its own offscreen boundary or fades to zero
    // at the loop seam; the authored placement is never overwritten by CSS.
    if(scene===0){
      this.ballet(t);
      each('curtain-left',e=>base(e,`skewX(${Math.sin(t*.5)*.7})`));
      each('curtain-right',e=>base(e,`translate(400 0) skewX(${Math.sin(t*.5+.7)*-.7}) translate(-400 0)`));
      const beat=MusicSync.pulse(t),bar=MusicSync.barPulse(t);
      each('spotlight',e=>op(e,.18+.035*Math.sin(t*.7)+bar*.035));
      this.beams.forEach((e,i)=>{set(e,`rotate(${Math.sin(t*.18+i)*4} ${[90,200,310][i]} 14)`);op(e,.34+.065*Math.sin(t*.5+i)+bar*.04)});
      each('music-note',(e,i)=>{const p=MusicSync.phase(t,8+i*.5,i*.7);base(e,`translate(${Math.sin(p*6.28+i)*7} ${-p*68})`);op(e,Math.sin(p*Math.PI)**2*(.28+beat*.11))});
      each('sparkle',(e,i)=>{const tw=(.5+.5*Math.sin(t*1.1+i*2.3))**5;op(e,Math.min(.82,tw*.5+beat*(i%3===0?.32:.12)))});
      each('rose-petal',(e,i)=>{const p=this.phase(t,10+i*.8,i),o=this.props.get(e);set(e,`translate(${Math.sin(p*6.28+i)*18+p*12} ${p*210}) rotate(${p*200} ${o.x} ${o.y})`);op(e,Math.sin(p*Math.PI)*.5)});
      this.noteTrail.forEach((e,i)=>{const p=this.phase(t,5,i);this.attr(e,'cx',190+Math.sin(p*5+i)*40);this.attr(e,'cy',170-p*85);op(e,Math.sin(p*Math.PI)*.22)});
    }else if(scene===1){
      this.walker(t);
      each('sun',e=>op(e,.7+.06*Math.sin(t*.4)));
      each('sun-ray',e=>set(e,`rotate(${t*3} 0 0)`));
      each('cloud',(e,i)=>{const p=this.phase(t,48+i*7,i);set(e,`translate(${470-p*550} ${35+i*10})`)});
      each('mountain',(e,i)=>op(e,.62+i*.08));
      each('tree',(e,i)=>base(e,`rotate(${Math.sin(t*.8+i*.6)*1.5} 0 0)`));
      each('bird-flock',e=>set(e,`translate(${-30+(t*10)%480} ${70+Math.sin(t*.18)*8})`));
      each('bird-small',(e,i)=>base(e,`scale(1 ${.65+.35*Math.sin(t*4+i)})`));
      each('dust-particle',(e,i)=>{const p=this.phase(t,6,i);base(e,`translate(${p*12} ${-p*20})`);op(e,Math.sin(p*Math.PI)*.3)});
      this.attr(this.road,'stroke-dasharray','2 6');this.attr(this.road,'stroke-dashoffset',-t*3);
    }else if(scene===2){
      this.bird(t);
      each('cloud-layer',(e,i)=>{const p=this.phase(t,55+i*15,i);base(e,`translate(${440-p*900} 0)`)});
      each('sun-glow',e=>op(e,.5+.05*Math.sin(t*.4)));
      each('feather',(e,i)=>{const p=this.phase(t,10+i,i);const box=e.getBBox();set(e,`translate(${-p*95+Math.sin(p*6.28)*12} ${p*85}) rotate(${Math.sin(p*6.28)*45} ${box.x+box.width/2} ${box.y+box.height/2})`);op(e,Math.sin(Math.PI*p)**2*.45)});
      each('wind-line',(e,i)=>{const p=this.phase(t,3+i*.3,i);base(e,`translate(${230-p*350} 0)`);op(e,Math.sin(p*Math.PI)**2*.16)});
      each('distant-bird',(e,i)=>set(e,`translate(${-30+((t*(9+i*2)+i*130)%480)} ${48+i*25+Math.sin(t+i)*2})`));
      each('leaf',(e,i)=>{const p=this.phase(t,8,i);base(e,`translate(${-p*150} ${Math.sin(p*6.28)*12})`);op(e,Math.sin(p*Math.PI)*.35)});
      this.thermals.forEach((e,i)=>{set(e,`translate(${-t*5%90} ${Math.sin(t*.3+i)*8})`);op(e,.05+.025*Math.sin(t*.5+i))});
    }else{
      const growth=this.smooth(t/8),height=.17+.83*growth,sway=Math.sin(t*.7)*1.6*growth;
      set(this.plant,`translate(200 200) rotate(${sway}) scale(1 ${height})`);
      this.rootPaths.forEach((e,i)=>this.attr(e,'stroke-dashoffset',1-this.smooth((t-i*.45)/5)));
      each('leaf',(e,i)=>{const g=.07+.93*this.smooth((t-1.2-Math.floor(i/2)*1.1)/3.5);set(e,`rotate(${Math.sin(t*.9+i*.7)*3} 0 0) scale(${g})`);op(e,.85)});
      each('petal',(e,i)=>{const bloom=.08+.92*this.smooth((t-4.2-i*.08)/3.2);set(e,`scale(${bloom*(1+.015*Math.sin(t*.9+i))} ${bloom})`);op(e,.95)});
      each('flower-center',e=>set(e,`scale(${.2+.8*this.smooth((t-4)/3)})`));
      each('pollen',(e,i)=>{const p=this.phase(t,6+i*.3,i);const x=200+Math.sin(p*5+i)*35+p*15,y=200-125*height-p*65;this.attr(e,'cx',x);this.attr(e,'cy',y);op(e,Math.sin(p*Math.PI)*.55*growth)});
      each('water-drop',(e,i)=>{const p=this.phase(t,5+i*.2,i),x=[150,250,180,230][i];this.attr(e,'cx',x);this.attr(e,'cy',40+Math.min(p/.8,1)**2*160);op(e,p<.8?Math.sin(p/.8*Math.PI)*.5:0);const q=Math.max(0,(p-.8)/.2),r=this.ripples[i];this.attr(r,'cx',x);this.attr(r,'rx',q*12);this.attr(r,'ry',q*2.5);op(r,p>.8?(1-q)*.5:0)});
      each('butterfly',(e,i)=>set(e,`translate(${200+Math.sin(t*.35+i*3)*95} ${110+Math.sin(t*.6+i)*25}) rotate(${Math.cos(t*.35+i*3)*8})`));
      each('butterfly-wing',(e,i)=>base(e,`scale(${.3+.7*Math.abs(Math.sin(t*14+Math.floor(i/2)))} 1)`));
      each('grass',(e,i)=>base(e,`rotate(${Math.sin(t*1.2+i*.5)*3} ${[30,50,70,320,340][i]} 0)`));
      const bloomBeat=MusicSync.barPulse(t);
      each('glow-aura',e=>{this.attr(e,'cy',200-125*height);op(e,.42+.12*Math.sin(t*.7)+bloomBeat*.09)});
      this.fireflies.forEach((e,i)=>{this.attr(e,'cx',45+i*20+Math.sin(t*.35+i)*13);this.attr(e,'cy',150+Math.cos(t*.4+i*1.8)*35);op(e,Math.min(.82,(.5+.5*Math.sin(t*.8+i*2))**4*.62+bloomBeat*(i%4===0?.22:.05)))});
      this.attr(this.dew,'cx',-35);this.attr(this.dew,'cy',8);op(this.dew,growth*.6);
    }
  },
  ballet(t){
    const poses=[[-32,-16,32,-22,34,29,-3],[-17,-33,17,-33,13,23,0],[-40,2,40,2,39,24,-5],[-28,23,13,-35,23,53,3]];
    // OG index timing: 4s per pose, with movement concentrated in the first 1.8s.
    // Keep the improved SVG/articulation, but do not let the music clock change choreography pace.
    const poseDur=4,transDur=1.8,wrapped=((t/poseDur)%poses.length+poses.length)%poses.length;
    const i=Math.floor(wrapped),poseProgress=wrapped-i,transRatio=transDur/poseDur;
    const p=poseProgress<transRatio?this.smooth(poseProgress/transRatio):1,a=poses[i],b=poses[(i+1)%poses.length],v=a.map((n,j)=>lerp(n,b[j],p));
    const angle=v[6]+Math.sin(t*.7)*.55;
    this.transform(this.el('ballet-dancer'),`translate(200 155) rotate(${angle} -8 67)`);
    [['l',[-10,8],[v[0],v[1]],-1],['r',[10,8],[v[2],v[3]],1]].forEach(([side,root,target,bend])=>{
      const hand=this.limb(this.el('b-arm-'+side),root,target,21,22,bend);this.attr(this.el('b-hand-'+side),'cx',hand[0]);this.attr(this.el('b-hand-'+side),'cy',hand[1]);
    });
    const foot=this.limb(this.el('b-leg-ext-line'),[4,35],[v[4],v[5]],18,18,-1);
    const e=this.el('b-foot-ext');this.attr(e,'cx',foot[0]+3);this.attr(e,'cy',foot[1]);this.transform(e,`rotate(${-15+Math.sin(t*.5)*12} ${foot[0]} ${foot[1]})`);
    this.transform(this.el('b-head'),`rotate(${-angle*.6} 0 3)`);
    this.attr(this.el('b-tutu'),'rx',30+Math.sin(t*1.4)*1.3);
    this.attr(this.el('b-shadow'),'rx',28+Math.abs(angle)*.7);
  },
  roadPoint(x){
    // The road consists of two quadratic Bezier segments, exactly as drawn.
    const u=Math.max(0,Math.min(1,x/200));
    if(x<=200)return 260-20*u*(1-u);
    const v=Math.max(0,Math.min(1,(x-200)/200));return (1-v)**2*260+2*(1-v)*v*270+v*v*255;
  },
  walker(t){
    // Restore the OG journey walker exactly in feel: it starts offscreen at -30,
    // advances at the original .12px/frame (~7.2px/s at 60Hz), and uses the
    // original stride/bob/arm formulas instead of the music clock.
    let x=-30+t*7.2;if(x>430)x=-30+((x+30)%460);
    const stride=Math.sin(t*4)*12,bob=Math.abs(Math.sin(t*4))*-2.5;
    this.transform(this.el('journey-walker'),`translate(${x} ${240+bob})`);
    const legL=this.el('jw-leg-l'),legR=this.el('jw-leg-r'),armL=this.el('jw-arm-l'),armR=this.el('jw-arm-r'),head=this.el('jw-head');
    this.attr(legL,'x2',-2+stride*.3);this.attr(legL,'y2',20+Math.abs(stride)*.15);
    this.attr(legR,'x2',2-stride*.3);this.attr(legR,'y2',20+Math.abs(-stride)*.15);
    this.attr(armL,'x2',-8-stride*.25);this.attr(armL,'y2',10+stride*.15);
    this.attr(armR,'x2',8+stride*.25);this.attr(armR,'y2',10-stride*.15);
    this.attr(head,'cy',-14+bob*.3);
    this.attr(this.el('jw-shadow'),'cy',20);this.attr(this.el('jw-shadow'),'rx',8);this.opacity(this.el('jw-shadow'),.15);
  },
  bird(t){
    const x=205+Math.sin(t*.23)*45,y=132+Math.sin(t*.34)*18;
    const bank=Math.cos(t*.34)*5;
    this.transform(this.el('bird-main'),`translate(${x} ${y}) rotate(${bank} 0 0)`);
    // Smoothly blend flapping into gliding; no phase discontinuity at a threshold.
    const glide=this.smooth((Math.sin(t*.32)+.15)/.7),amplitude=lerp(30,4,glide),wing=Math.sin(MusicSync.beats(t)*Math.PI)*amplitude;
    this.transform(this.el('bird-wing-top-rig'),`rotate(${-wing} -24 -5)`);
    this.transform(this.el('bird-wing-bot-rig'),`rotate(${wing*.82} -24 5)`);
    this.transform(this.el('bird-tail'),`rotate(${Math.sin(t*1.2)*3-bank*.3} -34 5)`);
  }
};


const BgScenes={
 container:null,scenes:[],current:2,active:false,duration:10000,elapsed:0,
 colors:['255,150,184','228,188,113','161,189,231','171,220,156'],
 init(){this.container=$('bg-scenes');this.scenes=[...this.container.querySelectorAll('.bg-scene')];SceneMotion.init();this.show(2)},
 show(idx){this.current=idx;this.elapsed=0;SceneMotion.ages[idx]=SceneMotion.paused?10:0;this.scenes.forEach((s,i)=>s.classList.toggle('active',i===idx));document.documentElement.style.setProperty('--scene-rgb',this.colors[idx]);SceneMotion.render(idx,SceneMotion.ages[idx])},
 next(){this.show((this.current+1)%4)},
 start(){this.active=true;this.container.classList.add('active');SceneMotion.start()},
 stop(){this.active=false;SceneMotion.stop()}
};
