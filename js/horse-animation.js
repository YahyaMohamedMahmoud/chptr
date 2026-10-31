/* CHPTR — horse frame-sequence renderer.
   Plays the supplied run and jump frames on one canvas, in the stage's 1536×1024 coordinates.
   Every frame is drawn with ONE scale factor and anchored by its right edge (nose / front hooves)
   and its lowest point (hooves), so the horse never changes size from frame to frame.
   Also draws the floor reflection, contact shadow, hoof sparks and the shimmer. */
class HorseAnimation {
  constructor(canvas, config) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cfg = config;
    this.frames = { run: [], jump: [] }; this.sparks = []; this.res = 1; this.lastX = null; this.vx = 0;
    // Animated by the GSAP master timeline.
    this.state = { seq: 'run', f: 0, jf: 0, x: -500, y: config.horse.ground, floor: config.horse.ground,
                   reflection: 0, shadow: 0, sparkle: 0, shine: -1, visible: 0,
                   k: 1,      // depth: >1 while the horse is in front of the wall, exactly 1 once it is on it
                   dim: 0 };  // current room darkness, so the cut-out furniture matches the background
    this.glow = HorseAnimation.makeGlow();
  }

  static makeGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,205,1)'); g.addColorStop(.3, 'rgba(255,196,100,.6)'); g.addColorStop(1, 'rgba(255,160,50,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return c;
  }

  /* Load and decode all used poses behind the curtains, at most three at a time.
     Playback never depends on another network request. */
  async preload() {
    const { run, jump } = this.cfg.assets;
    this.frames.run = Array(run.count); this.frames.jump = Array(jump.count);
    this.registerRun();
    const order = [...new Set(this.runOrder || [...Array(run.count).keys()])];
    const jobs = [...order.map(i => ['run', i]), ...Array.from({length: jump.count}, (_, i) => ['jump', i])];
    let next = 0, failed = false;
    const worker = async () => {
      while (next < jobs.length) {
        const [seq, i] = jobs[next++], spec = this.cfg.assets[seq];
        const src = `${spec.path}${String((spec.start || 1) + i).padStart(3, '0')}.${spec.ext}`;
        try { this.frames[seq][i] = this.prepareFrame(await HorseAnimation.loadImage(src)); }
        catch { failed = true; }
      }
    };
    await Promise.all(Array.from({length: 3}, worker));
    return !failed;
  }
  prepareFrame(img) {
    const k = this.cfg.horse.scale / this.cfg.assets.frameScale;
    const store = Math.min(1, k * Math.max(this.res, 1.25) / (this.cfg.assets.sourceScale || 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * store));
    c.height = Math.max(1, Math.round(img.naturalHeight * store));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const sourceScale = this.cfg.assets.sourceScale || 1;
    c.naturalWidth = img.naturalWidth / sourceScale; c.naturalHeight = img.naturalHeight / sourceScale; c.store = store * sourceScale;
    return c;
  }
  registerRun() {
    this.runReg = HorseAnimation.RUN_REG.map(([dx, dy]) => ({ dx, dy }));
  }
  static async loadImage(src) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const img = new Image(); img.decoding = 'async';
          const timer = setTimeout(() => { img.onload = img.onerror = null; img.src = ''; reject(new Error('Image timeout')); }, 15000);
          const fail = error => { clearTimeout(timer); reject(error); };
          img.onerror = () => fail(new Error('Could not load ' + src));
          img.onload = async () => {
            try { if (img.decode) await img.decode(); clearTimeout(timer); resolve(img); }
            catch (error) { fail(error); }
          };
          img.src = src;
        });
      } catch (error) { if (attempt) throw error; }
    }
  }

  static RUN_REG = [[11.4,0.3],[7.1,-18.7],[7.5,0],[3.9,-2.2],[2.5,-4.8],[12.1,8],[39,9.1],[42,3.6],[21.6,1],[32.1,0.5],[66.2,-0.6],[103,-1.1],[107.2,-1.8],[84.3,-1.2],[42.8,-3.5],[24.7,-0.3],[25,-1.8],[24,0.7],[18.6,2],[15.1,4.2],[9.6,8.7],[4.7,4.1],[-7.8,-32.1],[-10.1,-2.2],[-12.9,-3],[-16.4,0],[9.4,6.9],[19,2.8],[8.8,2.7],[65.5,-2.1],[99.3,0],[100.8,1.2],[65.9,0.6],[13.4,-10.7],[3.3,1],[2.7,1.9],[0.6,3],[-1.7,1.6],[-6.9,-1],[-9.1,-0.1],[-1.2,-0.2],[0,0]];
  get runCount() { return this.cfg.assets.run.count; }
  get jumpCount() { return this.cfg.assets.jump.count; }
  /* Nearest successfully loaded frame, so a missing file never produces a gap. */
  current() {
    const S = this.state, list = this.frames[S.seq];
    if (S.seq === 'run' && this.runFrameAt) S.f = this.runFrameAt(S.x);
    // runOrder: the gallop as played (one clean stride repeated as often as the run needs)
    let i = Math.round(S.seq === 'run' ? S.f : S.jf);
    if (S.seq === 'run' && this.runOrder) i = this.runOrder[Math.min(this.runOrder.length - 1, Math.max(0, i))];
    for (let d = 0; d < list.length; d++) { if (list[i - d]) return list[i - d]; if (list[i + d]) return list[i + d]; }
    return null;
  }
  /* Drawn box of an image: constant px-per-source-px, anchored at right edge + bottom.
     depth > 1 enlarges it around its ground contact (the horse is nearer than the wall). */
  box(img, x = this.state.x, y = this.state.y, depth = 1) {
    const k = this.cfg.horse.scale / this.cfg.assets.frameScale, w0 = img.naturalWidth * k, h0 = img.naturalHeight * k;
    const w = w0 * depth, h = h0 * depth;
    // Scale around the hoof line: centre scaling lifts the feet before takeoff.
    let pivot = 0, cropLift = 0;
    const r = this.runReg && this.runReg[this.frames.run.indexOf(img)];
    if (r) { pivot = r.dx * k * depth; cropLift = r.dy * k * depth; }
    // Measured hind-hoof distances from the right crop edge, source 090–105.
    // Register the actual pose being drawn, not the floating timeline frame:
    // crop widths change while the hoof must remain in the same world position.
    if (this.frames.jump.includes(img)) {
      const support = [634.5,648.02,663,672.81,678.87,682.79,687.5,690.4,
        698.06,701.54,697.5,699,697.48,701.02,720.95,736.95];
      const frame = this.frames.jump.indexOf(img);
      if (frame < support.length) pivot = (support[frame] - support[0]) * k * depth;
      else {
        // Carry the registration into flight, then merge exactly into the logo.
        const t = (frame - support.length + 1) / (this.jumpCount - support.length);
        const registration = 1 - t * t * (3 - 2 * t);
        pivot = (support.at(-1) - support[0]) * k * depth * registration;
        // Once airborne, folding legs shorten the crop. Bottom anchoring alone
        // would pull the head DOWN as the feet tuck. Preserve upper-body height
        // at release and gradually blend into the final image's exact box.
        const launch = this.frames.jump[support.length - 1];
        if (launch) cropLift = (img.naturalHeight - launch.naturalHeight) * k * depth * registration;
      }
    }
    const jumpIndex = this.frames.jump.indexOf(img);
    if (this.state.airborne && jumpIndex >= 0) {
      // Track the head and upper-body height, not the changing hoof crop.
      // Tucking or extending legs cannot lift/drop the whole horse anymore.
      const anchor = HorseAnimation.JUMP_ANCHORS[jumpIndex];
      return { w, h, l: this.state.anchorX - anchor[2] * k * depth, t: this.state.anchorY };
    }
    return { w, h, l: x - w + pivot, t: y - h + cropLift };
  }

  /* Foreground furniture cut out of the background, drawn over the horse so it runs BEHIND the table. */
  setForeground(image, points) {
    this.fgImage = image; this.fgPath = new Path2D();
    points.forEach(([x, y], i) => i ? this.fgPath.lineTo(x, y) : this.fgPath.moveTo(x, y)); this.fgPath.closePath();
    this.fgRight = Math.max(...points.map(p => p[0]));
  }
  drawForeground(b) {
    if (!this.fgImage || !this.fgImage.naturalWidth || b.l > this.fgRight) return;
    const { ctx } = this, { width: W, height: H } = this.cfg.stage;
    ctx.save(); ctx.clip(this.fgPath); ctx.drawImage(this.fgImage, 0, 0, W, H);
    if (this.state.dim > .005) { ctx.fillStyle = `rgba(5,3,2,${this.state.dim})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  /* Fine marble dust shaken loose where the horse meets the wall. */
  burst(img) {
    const b = this.box(img);
    for (let i = 0; i < 46; i++) this.sparks.push({ x: b.l + b.w * (.1 + Math.random() * .8), y: b.t + b.h * (.55 + Math.random() * .4),
      vx: (Math.random() - .5) * 40, vy: 10 + Math.random() * 30, g: 40, life: 1, decay: .55 + Math.random() * .5, r: .4 + Math.random() * .8 });
  }

  resize(res) {
    const { width: W, height: H } = this.cfg.stage;
    this.res = res; this.canvas.width = Math.round(W * res); this.canvas.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
  }
  clear() { const { width: W, height: H } = this.cfg.stage; this.ctx.clearRect(0, 0, W, H); this.sparks.length = 0; }

  draw(dt) {
    const { ctx } = this, S = this.state, { width: W, height: H } = this.cfg.stage;
    ctx.clearRect(0, 0, W, H);
    if (this.lastX !== null && dt > 0) this.vx = this.vx * .7 + ((S.x - this.lastX) / dt) * .3;
    this.lastX = S.x;
    const img = S.visible > 0 ? this.current() : null;
    if (!img) return this.drawSparks(dt, null);
    const b = this.box(img, S.x, S.y, S.k), fl = S.floor;
    // 1 · soft, restrained reflection on the marble, fading with distance from the floor line
    if (S.reflection > .005) {
      ctx.save(); ctx.globalAlpha = S.reflection; ctx.translate(0, 2 * fl); ctx.scale(1, -1);
      ctx.drawImage(img, b.l, b.t, b.w, b.h); ctx.restore();
      const top = 2 * fl - S.y, g = ctx.createLinearGradient(0, top, 0, top + b.h * .7);
      g.addColorStop(0, 'rgba(0,0,0,.1)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g; ctx.fillRect(b.l - 40, top, b.w + 80, b.h + 20); ctx.restore();
    }
    if (S.shadow > .01) {
      const cx = b.l + b.w * .52, rx = b.w * .42;
      ctx.save(); ctx.translate(cx, fl + 3); ctx.scale(1, 10 / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${.5 * S.shadow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // 4 · light motion blur: one faint ghost a few px behind, only at speed (no filters)
    const speed = Math.abs(this.vx);
    if (speed > 160) { ctx.globalAlpha = Math.min(.22, (speed - 160) / 900); ctx.drawImage(img, b.l - this.vx * .018, b.t, b.w, b.h); }
    ctx.globalAlpha = S.visible;
    if (S.shine > -.2 && S.shine < 1.2) ctx.drawImage(this.shined(img, b), b.l, b.t, b.w, b.h);
    else ctx.drawImage(img, b.l, b.t, b.w, b.h);
    ctx.globalAlpha = 1;
    this.drawSparks(dt, b);
    this.drawForeground(b);
  }

  /* One golden shimmer travelling left → right, clipped to the horse's own pixels. */
  shined(img, b) {
    const o = this.off || (this.off = document.createElement('canvas')), x = o.getContext('2d');
    const pw = Math.ceil(b.w * this.res), ph = Math.ceil(b.h * this.res);
    if (o.width !== pw || o.height !== ph) { o.width = pw; o.height = ph; }
    x.setTransform(this.res, 0, 0, this.res, 0, 0); x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, b.w, b.h); x.drawImage(img, 0, 0, b.w, b.h);
    x.globalCompositeOperation = 'source-atop';
    const gx = -b.w * .3 + b.w * 1.6 * this.state.shine, g = x.createLinearGradient(gx - 70, 0, gx + 70, b.h * .45);
    g.addColorStop(0, 'rgba(255,244,210,0)'); g.addColorStop(.5, 'rgba(255,244,210,.55)'); g.addColorStop(1, 'rgba(255,244,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, b.w, b.h); return o;
  }

  /* Restrained sparkles near the hooves. */
  drawSparks(dt, b) {
    const { ctx } = this, S = this.state;
    if (b && dt > 0 && S.sparkle > 0) {
      let n = S.sparkle * 20 * dt;
      while (n-- > Math.random()) this.sparks.push({ x: b.l + b.w * (.2 + Math.random() * .65), y: S.floor - 3 - Math.random() * 10,
        vx: -40 - Math.random() * 80, vy: -10 - Math.random() * 40, life: 1, decay: 1.4 + Math.random(), r: .6 + Math.random() * 1.1 });
    }
    if (!this.sparks.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]; p.life -= dt * p.decay; if (p.life <= 0) { this.sparks.splice(i, 1); continue; }
      p.vy += (p.g ?? 90) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const s = p.r * 6; ctx.globalAlpha = p.life * .7; ctx.drawImage(this.glow, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }
  get idle() { return this.state.visible <= 0 && !this.sparks.length; }
}
