/* A short opening scene, with asset readiness rather than fake progress. */
window.openCurtains = function (ready, onReady, onFallback) {
  const overlay = document.querySelector('#preloader');
  const paper = overlay.querySelector('.intro-paper');
  const ink = overlay.querySelector('.intro-ink');
  const caret = overlay.querySelector('.intro-caret');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap) { overlay.remove(); onFallback(); return; }
  const text = 'Every story begins\nwith a chapter…';
  gsap.set(paper, { opacity: 1, xPercent: -50, yPercent: -50, y: 0 });
  let finished = false, timeout;
  const finish = ok => {
    if (finished) return;
    finished = true; clearTimeout(timeout);
    const opening = gsap.timeline({ onComplete: () => {
      overlay.remove(); (ok ? onReady : onFallback)();
    } });
    caret.style.display = 'none';
    if (reduce) {
      opening.to(paper, { opacity: 0, duration: .15, ease: 'sine.in' });
      opening.call(() => { document.documentElement.classList.add('scene-ready'); overlay.style.background = 'transparent'; }, null, .15);
      opening.to(overlay, { opacity: 0, duration: .2 });
      return;
    }
    // The parchment burns away from its lower corners; embers rise, and the curtains part behind the fire.
    let fire = null;
    try { fire = burnPaper(paper, ink, overlay); } catch (error) { console.warn('CHPTR: burn skipped.', error); }
    if (!fire) {   // anything unusual: the quiet exit, never a stuck overlay
      opening.to(paper, { opacity: 0, y: -12, duration: .5, ease: 'sine.in' })
        .call(() => { document.documentElement.classList.add('scene-ready'); overlay.style.background = 'transparent'; }, null, .35)
        .to('.curtain-left', { xPercent: -101, scaleX: .86, duration: 2.45, ease: 'power1.inOut' }, .35)
        .to('.curtain-right', { xPercent: 101, scaleX: .86, duration: 2.45, ease: 'power1.inOut' }, .35)
        .to('#curtain-edge-left', { attr: { d: 'M0 0 L1 0 C.98 .28 .79 .72 .72 1 L0 1 Z' }, duration: 1.65, ease: 'sine.inOut' }, .35)
        .to('#curtain-edge-right', { attr: { d: 'M1 0 L0 0 C.02 .28 .21 .72 .28 1 L1 1 Z' }, duration: 1.65, ease: 'sine.inOut' }, .35);
      return;
    }
    const OPEN = 1.45;
    opening.to(fire, { p: 1.12, duration: 2.1, ease: 'power1.in', onUpdate: fire.draw }, 0)
      .to(fire.light, { opacity: .9, duration: .9, ease: 'sine.in' }, 0)
      .to(fire.light, { opacity: 0, duration: 1.1, ease: 'sine.inOut' }, 1.9)
      .call(() => { document.documentElement.classList.add('scene-ready'); overlay.style.background = 'transparent'; }, null, OPEN - .15)
      // Gather the velvet toward its outer rail while its free edge bows under tension.
      // Both sides finish together, so the horse starts without an extra pause.
      .to('.curtain-left', { xPercent: -101, scaleX: .86, duration: 2.45, ease: 'power1.inOut' }, OPEN)
      .to('.curtain-right', { xPercent: 101, scaleX: .86, duration: 2.45, ease: 'power1.inOut' }, OPEN)
      .to('#curtain-edge-left', { attr: { d: 'M0 0 L1 0 C.98 .28 .79 .72 .72 1 L0 1 Z' }, duration: 1.65, ease: 'sine.inOut' }, OPEN)
      .to('#curtain-edge-right', { attr: { d: 'M1 0 L0 0 C.02 .28 .21 .72 .28 1 L1 1 Z' }, duration: 1.65, ease: 'sine.inOut' }, OPEN)
      .call(fire.stop, null, OPEN + 2.45);
  };
  const writing = new Promise(resolve => {
    const script = gsap.timeline();
    script.to(paper, { opacity: 1, y: 0, duration: reduce ? .2 : .7, ease: 'power2.out' }, .2);
    if (reduce) script.call(() => { ink.textContent = text; }, null, .4);
    else {
      let moment = 1.05;
      Array.from(text).forEach((character, index) => {
        script.call(() => { ink.textContent = text.slice(0, index + 1); }, null, moment);
        moment += character === '\n' ? .32 : character === ' ' ? .065 : .075;
      });
    }
    script.call(() => { caret.style.display = 'none'; }, null, '+=.25');
    script.call(resolve, null, '+=.8');
  });
  // Never leave visitors trapped behind fabric on an unavailable asset.
  timeout = setTimeout(() => finish(false), 25000);
  Promise.all([writing, ready]).then(([, ok]) => finish(ok !== false)).catch(() => finish(false));
};


/* Burn the parchment (image + written phrase) on a small 1x canvas.
   No pixel reads (so it also works from file://): one loop per frame fills an alpha mask and a tint layer
   from a burn map computed once, then three composited draws. Fixed ember budget; nothing kept afterwards. */
function burnPaper(paper, ink, overlay) {
  const img = paper.querySelector('img'), phrase = paper.querySelector('.intro-phrase');
  const box = paper.getBoundingClientRect();
  const W = Math.min(420, Math.round(box.width)), H = Math.round(W * box.height / box.width), S = W / box.width, N = W * H;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'burn';
  const ctx = cv.getContext('2d');
  // The phrase, as it stands on the page.
  const cs = getComputedStyle(phrase), pr = phrase.getBoundingClientRect(), lh = parseFloat(cs.lineHeight) * S;
  const lines = ink.textContent.split('\n'), tx = (pr.left - box.left + pr.width / 2) * S, ty = (pr.top - box.top) * S;
  const font = `italic ${parseFloat(cs.fontSize) * S}px ${cs.fontFamily}`, color = cs.color, spacing = cs.letterSpacing;
  const drawPage = () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing;
    lines.forEach((line, i) => ctx.fillText(line, tx, ty + lh * (i + .5)));
  };
  drawPage();
  img.style.visibility = 'hidden'; phrase.style.visibility = 'hidden'; paper.appendChild(cv);

  // Burn map: distance from the nearest lower corner, roughened by two octaves of value noise.
  const G = 22, gw = Math.ceil(W / G) + 2, gh = Math.ceil(H / G) + 2, grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
  const smooth = t => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const gx = x / G, gy = y / G, fx = smooth(gx % 1), fy = smooth(gy % 1), x0 = (gx | 0) % (gw - 1), y0 = (gy | 0) % (gh - 1), i = y0 * gw + x0;
    const a = grid[i] + (grid[i + 1] - grid[i]) * fx, b = grid[i + gw] + (grid[i + gw + 1] - grid[i + gw]) * fx;
    return a + (b - a) * fy;
  };
  const map = new Float32Array(N); let lo = 1e9, hi = -1e9;
  const maxD = Math.hypot(W, H);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const d = Math.min(Math.hypot(x, H - y), Math.hypot(W - x, H - y)) / maxD;
    const v = d + .16 * noise(x, y) + .07 * noise(x * 2.3 + 40, y * 2.3 + 90);
    map[i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  for (let i = 0; i < N; i++) map[i] = (map[i] - lo) / (hi - lo);

  // Mask (alpha = what is left of the page) and tint (scorch, flame front, ash) layers.
  const mk = document.createElement('canvas'); mk.width = W; mk.height = H; const mctx = mk.getContext('2d');
  const tk = document.createElement('canvas'); tk.width = W; tk.height = H; const tctx = tk.getContext('2d');
  const md = mctx.createImageData(W, H), td = tctx.createImageData(W, H), mp = md.data, tp = td.data;

  // Embers: a fixed pool drawn on one screen-sized 1x canvas from a single soft sprite.
  const ec = document.createElement('canvas'); ec.className = 'embers';
  ec.width = innerWidth; ec.height = innerHeight; overlay.appendChild(ec);
  const ectx = ec.getContext('2d');
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 16;
  const sctx = sprite.getContext('2d'), grad = sctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(255,240,200,1)'); grad.addColorStop(.35, 'rgba(255,180,70,.9)'); grad.addColorStop(1, 'rgba(255,90,20,0)');
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 16, 16);
  const MAX = 180, px = new Float32Array(MAX), py = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX),
    life = new Float32Array(MAX), age = new Float32Array(MAX), size = new Float32Array(MAX);
  let alive = 0, last = performance.now();
  const inset = { l: W * .04, r: W * .96, t: H * .03, b: H * .97 };   // keep embers off the transparent corners
  const spawn = (x, y) => {
    if (alive >= MAX || x < inset.l || x > inset.r || y < inset.t || y > inset.b) return;
    const k = alive++;
    px[k] = box.left + x / S; py[k] = box.top + y / S;
    vx[k] = (Math.random() - .5) * 50; vy[k] = -(40 + Math.random() * 110);
    life[k] = .7 + Math.random() * 1.4; age[k] = 0; size[k] = 1 + Math.random() * 2.2;
  };
  const light = document.createElement('i'); light.className = 'fire-light';
  light.style.left = box.left + box.width / 2 + 'px'; light.style.top = box.top + box.height * .8 + 'px';
  overlay.appendChild(light);

  const fire = { p: 0, light, stopped: false };
  const EDGE = .09, FRONT = .022, HEAT = .06;
  fire.draw = () => {
    if (fire.stopped) return;
    const p = fire.p, jitter = (Math.random() - .5) * .004;
    let tries = 0;
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const d = p - map[i] + jitter;
      if (d >= EDGE) { mp[j + 3] = 0; tp[j + 3] = 0; continue; }
      if (d < -HEAT) { mp[j + 3] = 255; tp[j + 3] = 0; continue; }
      mp[j + 3] = 255;
      if (d < 0) {                       // scorching: the paper browns before it catches
        tp[j] = 96; tp[j + 1] = 44; tp[j + 2] = 16; tp[j + 3] = (d + HEAT) / HEAT * 190;
      } else if (d < FRONT) {            // the glowing front
        const k = d / FRONT;
        tp[j] = 255; tp[j + 1] = 236 - 120 * k; tp[j + 2] = 170 - 150 * k; tp[j + 3] = 255;
        if (p < 1.05 && tries < 22 && Math.random() < .004) { tries++; spawn(i % W, (i / W) | 0); }
      } else {                           // ash, thinning to nothing
        const k = (d - FRONT) / (EDGE - FRONT);
        tp[j] = 38; tp[j + 1] = 14; tp[j + 2] = 6; tp[j + 3] = 255; mp[j + 3] = 255 * (1 - k) * (1 - k);
      }
    }
    mctx.putImageData(md, 0, 0); tctx.putImageData(td, 0, 0);
    drawPage();
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mk, 0, 0);
    ctx.globalCompositeOperation = 'source-atop'; ctx.drawImage(tk, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };
  const tick = () => {
    const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
    ectx.clearRect(0, 0, ec.width, ec.height);
    ectx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < alive; k++) {
      age[k] += dt;
      if (age[k] >= life[k]) { alive--; px[k] = px[alive]; py[k] = py[alive]; vx[k] = vx[alive]; vy[k] = vy[alive]; life[k] = life[alive]; age[k] = age[alive]; size[k] = size[alive]; k--; continue; }
      vy[k] -= 30 * dt; vx[k] += (Math.random() - .5) * 60 * dt;
      px[k] += vx[k] * dt; py[k] += vy[k] * dt;
      const t = age[k] / life[k];
      ectx.globalAlpha = t < .2 ? t / .2 : 1 - (t - .2) / .8;
      const r = size[k] * 2.2 * (1 - t * .45);
      ectx.drawImage(sprite, px[k] - r, py[k] - r, r * 2, r * 2);
    }
    ectx.globalAlpha = 1;
    light.style.setProperty('--f', .82 + Math.random() * .18);
  };
  gsap.ticker.add(tick);
  fire.stop = () => { fire.stopped = true; gsap.ticker.remove(tick); ec.remove(); };
  return fire;
}
