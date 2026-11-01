/* CHPTR — Coming Soon. One GSAP master timeline; every number you may want to tune is in CONFIG. */

const CONFIG = {
  stage: { width: 1536, height: 1024 },          // pixel space of the background image; everything is placed in it
  safe: { width: 520, height: 560 },             // part of the stage that is never cropped (arch, logo and text)
  assets: {
    run: { path: 'images/horse-', start: 48, count: 42, ext: 'webp', loop: [0, 20] },
    jump: { path: 'images/horse-', start: 90, count: 64, ext: 'webp' },
    final: 'images/horse-final.webp',
    frameScale: 1,
    sourceScale: .375,   // frames are stored at 37.5% of the original artwork (lossy WebP, ~27 KB each)
  },
  horse: {
    scale: .25,          // stage px per ORIGINAL artwork px — one value for the run, the jump and the logo
    finalRight: 959.5,   // final logo horse: right edge (front hooves), stage px   ← move the logo horse here
    finalBottom: 524,    // final logo horse: lowest point, stage px                ← and here (move the CSS logo block with it)
    ground: 725,         // hoof line on the floor BEHIND the left table, just in front of the arch wall
    apexLift: 14,        // the flight barely peaks above the final position, then settles onto it
    approachDepth: 1.04, // running line is slightly nearer the camera than the wall; shrinks to 1 on contact
    speed: 400,          // running speed (stage px / s) when it reaches the take-off — and kept in the air
    fps: 27.4,             // playback rate of the frame sequence at that speed
    leadIn: 240,         // the horse plants its hind hooves this far (stage px) short of the logo, rears and
                         // springs forward and up into the logo pose, like a real jump taken a stride early
  },
  timing: {
    atmosphere: 0,      // curtains already provide the introduction; enter immediately after they open
    // take-off and flight times are derived from the running speed, so the horse never brakes
    shimmer: 1.1,
    letterDuration: 1.0,
    comingSoonGap: .45,  // after the last CHPTR letter has settled
  },
  // Foreground furniture (left table, candles, glasses, chairs) traced in background pixels.
  // It is redrawn over the horse, so the horse emerges from BEHIND the table.
  foreground: [[0,560],[68,560],[74,600],[78,618],[92,618],[95,613],[110,613],[112,640],[124,640],[126,588],[141,588],
    [143,640],[154,640],[156,598],[172,598],[174,628],[188,624],[205,618],[240,614],[290,614],[312,619],[318,632],
    [310,690],[304,780],[292,850],[292,1024],[0,1024]],
  comingSoonPulse: { every: 3.2 },             // seconds of rest between two light passes across COMING SOON
};

const { width: W, height: H } = CONFIG.stage;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = $('#stage'), camera = $('#camera');
const horse = new HorseAnimation($('#horse-canvas'), CONFIG);
let scale = 1, tl;

/* ---------- layout: cover the viewport, but never crop the safe area around the arch ---------- */
function layout() {
  const iw = innerWidth, ih = innerHeight;
  scale = Math.min(Math.max(iw / W, ih / H), iw / CONFIG.safe.width, ih / CONFIG.safe.height);
  stage.style.setProperty('--s', scale);
  horse.resize(Math.min(scale * devicePixelRatio, 2));
  const v = visible(); $('#entrance-glow').style.left = `${v.l}px`;
}
function visible() {
  const w = Math.min(W, innerWidth / scale), h = Math.min(H, innerHeight / scale);
  return { l: (W - w) / 2, r: (W + w) / 2, t: (H - h) / 2, b: (H + h) / 2, w, h };
}
/* Place the static final horse (and its shimmer mask) on exactly the box of the last jump frame. */
function placeFinal(img) {
  const b = horse.box(img, CONFIG.horse.finalRight, CONFIG.horse.finalBottom);
  for (const el of $$('.horse-final')) Object.assign(el.style, { left: `${b.l}px`, top: `${b.t}px`, width: `${b.w}px`, height: `${b.h}px` });
}

/* Ease for a ballistic arc from y0 down/up to y1 whose apex is `lift` px above y1.
   y(t) = y0 + (y1 − y0)·t − 4A·t(1 − t): a parabola, i.e. constant gravity. A is solved so the apex fits. */
function flight(y0, y1, lift) {
  const D = y0 - y1;                         // rise from take-off to the final position (> 0 going up)
  let lo = 0, hi = 4 * D;
  for (let i = 0; i < 40; i++) {             // bisection on A: apex height above y1 grows with A
    const A = (lo + hi) / 2, t = Math.min(1, (1 + D / (4 * A)) / 2), apex = (D * t - D) + 4 * A * t * (1 - t);
    apex > lift ? hi = A : lo = A;
  }
  const A = (lo + hi) / 2;
  return t => t + (4 * A / D) * t * (1 - t);
}

/* ---------- master timeline ---------- */
function buildTimeline() {
  const C = CONFIG.horse, T = CONFIG.timing, v = visible(), S = horse.state;
  // Frames 090–105 rear around a planted hind hoof. They are not a
  // translating stride. Slow during the last running steps, then pivot.
  const PUSH = 16 / 42;   // a quick gather, not a long pause
  // The run carries the horse right under the logo; it plants just short of it and rises into place.
  const takeoff = C.finalRight - C.leadIn;
  const pxPerFrame = C.speed / C.fps, loop = CONFIG.assets.run.loop;
  // Gallop as played: the sequence from the loop start to the hand-over, with clean strides put in front
  // until the first step is beyond the visible left edge (the horse always enters from off-screen).
  const order = [...Array(horse.runCount).keys()].slice(loop ? loop[0] : 0);
  for (let j = loop ? loop[1] : 0; loop && takeoff - (order.length - 1) * pxPerFrame > v.l - 40; j = j > loop[0] ? j - 1 : loop[1])
    order.unshift(j);
  horse.runOrder = order;
  // Remove invisible strides, retaining the consecutive ending poses.
  const entryX = v.l - 12;
  const needed = Math.ceil((takeoff - entryX) / pxPerFrame) + 1;
  if (order.length > needed) order.splice(0, order.length - needed);
  const runFrames = order.length - 1, dist = takeoff - entryX, xStart = entryX;
  const BRAKE = .36;
  const cruiseTime = dist / C.speed - BRAKE / 2;
  const RUN = cruiseTime + BRAKE;
  const accel = t => {
    const elapsed = t * RUN;
    if (elapsed <= cruiseTime) return C.speed * elapsed / dist;
    const u = (elapsed - cruiseTime) / BRAKE;
    // Integrate a cosine deceleration; velocity and acceleration meet smoothly.
    return (C.speed * cruiseTime + C.speed * BRAKE * (u / 2 + Math.sin(Math.PI * u) / (2 * Math.PI))) / dist;
  };
  const liftOff = takeoff;
  const LEAP = .62;
  const finalAnchor = HorseAnimation.JUMP_ANCHORS.at(-1);
  const targetHeadX = C.finalRight - (finalAnchor[0] - finalAnchor[2]) * C.scale;
  const targetTop = C.finalBottom - finalAnchor[1] * C.scale;
  const travelEase = t => t < .8 ? t / .9 : ( .8 + .2 * ((t - .8) / .2 - .5 * ((t - .8) / .2) ** 2)) / .9;
  const nameFlightOffset = LEAP;
  const lastLetter = T.letterDuration;
  Object.assign(S, { airborne: false, anchorX: 0, anchorY: 0, seq: 'run', f: 0, jf: 0, x: xStart, y: C.ground, floor: C.ground, reflection: 0, shadow: 0, sparkle: 0, shine: -1, visible: 0, k: C.approachDepth });
  horse.clear(); horse.lastX = null;
  horse.runFrameAt = x => Math.max(0, runFrames - (takeoff - x) / pxPerFrame);   // legs locked to distance
  horse.runDuration = RUN;   // the loader uses it to decide when the curtains may open early

  gsap.set('#arch-light', { opacity: 0 });
  gsap.set('#arch-light .arch-bloom, #arch-light .arch-edge, #arch-light .arch-core', { strokeDashoffset: 1 });
  gsap.set('#arch-light .arch-runner', { strokeDashoffset: 0, opacity: 0 });
  gsap.set('#dim', { opacity: .62 }); gsap.set('#entrance-glow', { opacity: 0, scale: .8 }); gsap.set('#arch-glow, #impact', { opacity: 0 });
  gsap.set('.horse-final', { autoAlpha: 0 });
  gsap.set('#emblems > *', { autoAlpha: 0 }); gsap.set('.dots', { clipPath: 'inset(0 0 0 100%)' });
  gsap.set('#name .wordmark', { opacity: 0, y: 10, clipPath: 'inset(0 100% 0 0)' });
  if (soonLoop) soonLoop.kill();
  gsap.set('#coming-soon .ch', { color: '#f1d39a', textShadow: '0 0 12px rgba(255,178,79,.25)', y: 0, scale: 1, transformOrigin: '50% 60%' });
  gsap.set('#coming-soon', { clipPath: 'inset(0 50% 0 50%)', opacity: 0, letterSpacing: 18.9, paddingLeft: 18.9 });  // px: .9em of 21px → .55em
  gsap.set('.rule', { scaleX: 0 }); gsap.set('.diamond', { scale: 0, rotation: 45, boxShadow: '0 0 0 rgba(255,200,120,0)' });

  const m = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  // 1 · restaurant atmosphere: the room is a little dark and slowly warms
  m.addLabel('atmosphere', 0)
   .to('#dim', { opacity: .3, duration: 2.4 }, 'atmosphere')
  // 2 · golden entrance light at the lower-left edge
   .to('#entrance-glow', { opacity: 1, scale: 1, duration: 1.6, ease: 'sine.out' }, 'atmosphere+=.4')
   .addLabel('entrance', T.atmosphere)
  // 3 · horse enters from beyond the left edge; 4 · runs, frames locked to the distance covered
   .set(S, { visible: 1, reflection: .2, shadow: .8 }, 'entrance')
   .to(S, { x: takeoff, duration: RUN, ease: accel }, 'entrance')
   .to(S, { sparkle: .25, duration: .5, ease: 'sine.out' }, 'entrance+=.2')
   .to('#entrance-glow', { opacity: 0, duration: 1.4, ease: 'sine.inOut' }, 'entrance+=.6')
  // 5 · collected jump: the hind hoof supports the rising chest,
  //     then one short powerful leap up and INTO the wall — it lands on the marble as a relief,
  //     which is why it stays there. The rise decelerates to zero exactly at contact.
   .addLabel('jump', `entrance+=${RUN}`)
   .to('#arch-light', { opacity: 1, duration: .25 }, 'jump-=.15')
   .to('#arch-light .arch-bloom, #arch-light .arch-edge, #arch-light .arch-core', { strokeDashoffset: 0, duration: 2.1, ease: 'none' }, 'jump-=.15')
   .to('#arch-light .arch-runner', { opacity: 1, duration: .15 }, 'jump-=.15')
   .to('#arch-light .arch-runner', { strokeDashoffset: -1, duration: 2.1, ease: 'none' }, 'jump-=.15')
   .to('#arch-light .arch-runner', { opacity: 0, duration: .45 }, 'jump+=1.8')
   .set(S, { seq: 'jump', jf: 0 }, 'jump')  // natural: next frame after the gallop
   // Keep the supporting hoof planted while the source poses lift the chest.
   .to(S, { jf: 16, duration: PUSH || .001, ease: 'none' }, 'jump')
   .to(S, { x: liftOff, duration: PUSH || .001, ease: 'none' }, 'jump')   // no sliding translation during the planted pivot
   .to(S, { sparkle: 0, duration: .25 }, 'jump')
   .addLabel('leap', `jump+=${PUSH}`)
   .call(() => {
     const img = horse.frames.jump[16];
     if (!img) return;
     const b = horse.box(img, S.x, S.y, S.k);
     S.anchorX = b.l + HorseAnimation.JUMP_ANCHORS[16][2] * C.scale * S.k;
     S.anchorY = b.t;
     S.airborne = true;
   }, null, 'leap')
   .to(S, { anchorX: targetHeadX, duration: LEAP, ease: 'none' }, 'leap')
   .to(S, { anchorY: targetTop, duration: LEAP,
     ease: flight(C.ground - HorseAnimation.JUMP_ANCHORS[15][1] * C.scale * C.approachDepth, targetTop, 5) }, 'leap')
  // Real flight: constant forward speed, a gravity parabola up to the apex and down into place,
  // legs played at an even pace.
   // Legs keep moving through the whole flight (tuck → stretch), never frozen in mid-air.
   .to(S, { jf: 42, duration: LEAP, ease: 'none' }, 'leap')
   .to(S, { x: C.finalRight, duration: LEAP, ease: travelEase }, 'leap')
   // 106–111 still push off the floor; from 112 it is airborne: a gravity arc straight up that peaks
   // apexLift px above the logo and settles onto it as the legs stretch into the logo pose.
   .to(S, { y: C.finalBottom, duration: LEAP, ease: flight(C.ground, C.finalBottom, C.apexLift) }, 'leap')
   .to(S, { k: 1, duration: LEAP, ease: 'none' }, 'leap')
   .to(S, { shadow: 0, reflection: 0, duration: LEAP * .7, ease: 'sine.out' }, 'leap')
  // 6 · contact: a soft impact of light on the marble, a hair of camera jolt, fine dust drifting down;
  //     7 · one golden shimmer; then the static final horse takes over on the identical box
   .addLabel('freeze', `leap+=${LEAP}`)
   .to(S, { jf: horse.jumpCount - 1, duration: .28, ease: 'sine.out' }, 'freeze')
   .call(() => { const last = horse.frames.jump[horse.jumpCount - 1]; if (last && !reduced) horse.burst(last); }, null, 'freeze')
   .to('#impact', { keyframes: [{ opacity: 1, duration: .14, ease: 'power2.out' }, { opacity: 0, duration: 1.4, ease: 'sine.out' }] }, 'freeze')
   .to(camera, { keyframes: [{ y: .8, duration: .12, ease: 'power2.out' }, { y: 0, duration: .45, ease: 'sine.out' }] }, 'freeze')
   .to(S, { shine: 1.25, duration: T.shimmer, ease: 'power1.inOut' }, 'freeze+=.15')
   .set('.horse-final', { autoAlpha: 1 }, `freeze+=${.2 + T.shimmer}`)
   .set(S, { visible: 0 }, `freeze+=${.2 + T.shimmer}`)
   .call(() => { horse.frames = { run: [], jump: [] }; }, null, `freeze+=${.2 + T.shimmer}`)
   .to('#dim', { opacity: 0, duration: 1.6, ease: 'sine.inOut' }, 'freeze')
   .to('#arch-glow', { opacity: 1, duration: 1.8, ease: 'sine.inOut' }, 'freeze')
   .to('.dots', { autoAlpha: 1, clipPath: 'inset(0 0 0 0%)', duration: .8, ease: 'power2.out' }, 'freeze+=.15')
   .fromTo('.banner', { autoAlpha: 0, y: 12, rotation: -8, scaleX: .65 }, { autoAlpha: 1, y: 0, rotation: 0, scaleX: 1, duration: 1.1, ease: 'back.out(1.3)' }, 'freeze+=.3')
   .fromTo('.star', { autoAlpha: 0, scale: .4, rotation: -100 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 1, ease: 'back.out(1.5)' }, 'freeze+=.55')
  // 8 · CHPTR: a thin light line beneath the horse (and its reflection on the marble), then the letters
   .addLabel('name', `leap+=${nameFlightOffset}`)
   .to('#name .wordmark', { opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)', duration: T.letterDuration, ease: 'power2.out' }, 'name')
  // 9 · COMING SOON: centred mask opening outward, tracking settles, rules draw, the diamond glows once
   .addLabel('soon', `name+=${lastLetter + T.comingSoonGap}`)
   .to('#coming-soon', { clipPath: 'inset(0 0% 0 0%)', opacity: 1, duration: 1.3, ease: 'power2.inOut' }, 'soon')
   .to('#coming-soon', { letterSpacing: 11.55, paddingLeft: 11.55, duration: 1.6, ease: 'power2.out' }, 'soon')
   .to('.rule', { scaleX: 1, duration: 1.0, ease: 'power2.out' }, 'soon+=.8')
   .to('.diamond', { scale: 1, duration: .5, ease: 'power2.out' }, 'soon+=1.4')
   .to('.diamond', { keyframes: [{ boxShadow: '0 0 14px rgba(255,200,120,.9)', duration: .45 }, { boxShadow: '0 0 0 rgba(255,200,120,0)', duration: .9 }], ease: 'sine.inOut' }, 'soon+=1.8')
   .set('#coming-soon', { clipPath: 'none' }, 'soon+=1.4')       // let the glow breathe outside the line box
  // 10 · final state: candlelight, a few motes, and COMING SOON catching the light now and then
   .addLabel('final')
   .call(startSoonLoop, null, 'final');
  return m;
}
/* A light travels across COMING SOON letter by letter, rests, and comes back. */
let soonLoop;
function startSoonLoop() {
  if (soonLoop) soonLoop.kill();
  if (reduced) return;
  const chs = $$('#coming-soon .ch'), step = .07;
  soonLoop = gsap.timeline({ repeat: -1, repeatDelay: CONFIG.comingSoonPulse.every, delay: .6 })
    .to(chs, { scale: 1.14, color: '#fff7e0', textShadow: '0 0 14px rgba(255,206,122,.95)', y: -2, duration: .4, stagger: step, ease: 'sine.out' })
    .to(chs, { scale: 1, color: '#f1d39a', textShadow: '0 0 12px rgba(255,178,79,.25)', y: 0, duration: .65, stagger: step, ease: 'sine.inOut' }, .7)
    .to('.diamond', { keyframes: [{ boxShadow: '0 0 12px rgba(255,200,120,.85)', duration: .3 }, { boxShadow: '0 0 0 rgba(255,200,120,0)', duration: .8 }] }, chs.length * step);
}
/* ---------- ambience ---------- */
function candle(el) {
  gsap.to(el, { opacity: .6 + Math.random() * .4, scale: .95 + Math.random() * .1, duration: .1 + Math.random() * .25, ease: 'sine.inOut', onComplete: () => candle(el) });
}
// The canvas only works while the horse moves; after the freeze it is cleared once and left alone.
window.gsap?.ticker.add((time, deltaMs) => {
  if (!horse.idle) { horse.state.dim = +gsap.getProperty('#dim', 'opacity'); horse.draw(Math.min(deltaMs / 1000, .05)); horse.cleared = false; }
  else if (!horse.cleared) { horse.clear(); horse.cleared = true; }
});

/* ---------- start ---------- */
function start() {
  layout(); addEventListener('resize', layout);

  const soon = $('#coming-soon');
  soon.innerHTML = [...soon.textContent].map(c => c === ' ' ? '<span class="gap"> </span>' : `<span class="ch">${c}</span>`).join('');
  horse.setForeground($('.bg'), CONFIG.foreground);
  const finalImg = $('.horse-final');
  if (!finalImg.src.endsWith(CONFIG.assets.final)) finalImg.src = CONFIG.assets.final;
  const onFinal = () => placeFinal(finalImg);
  finalImg.complete && finalImg.naturalWidth ? onFinal() : finalImg.addEventListener('load', onFinal, { once: true });
  finalImg.addEventListener('error', () => console.warn('CHPTR: ' + CONFIG.assets.final + ' is missing.'), { once: true });

  tl = buildTimeline();
  const imageReady = img => new Promise(resolve => {
    const done = () => {
      if (!img.naturalWidth) { resolve(false); return; }
      (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(true));
    };
    if (img.complete) done();
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', () => resolve(false), { once: true }); }
  });
  const sceneReady = Promise.all([...document.images].map(imageReady)).then(results => results.every(Boolean));
  const revealFinal = () => { tl.progress(1); horse.state.visible = 0; };
  if (reduced) { openCurtains(sceneReady, revealFinal, revealFinal); return; }
  // Open as soon as every frame is decoded — or earlier, once the whole gallop is in and the
  // measured download rate says the remaining jump poses will land before they are played.
  const framesReady = new Promise(resolve => {
    const jumpBudget = (horse.runDuration || 2) + 1.0;   // seconds until the last jump pose is drawn
    horse.preload(p => {
      if (p.done === p.total) resolve(!p.failed);
      else if (!p.failed && p.runDone === p.runTotal && p.jumpDone >= 24 && p.remainingEstimate * 1.6 < jumpBudget) resolve(true);
    }).then(ok => resolve(ok), () => resolve(false));
  });
  openCurtains(Promise.all([sceneReady, framesReady]).then(results => results.every(Boolean)), () => {
    $$('#glows i').forEach(candle);
    tl.play(0);
  }, revealFinal);
}
if (!window.gsap) { document.documentElement.classList.add('no-motion'); console.error('CHPTR: GSAP failed to load.'); }
else start();
