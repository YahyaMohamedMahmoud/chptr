/* A short opening scene, with asset readiness rather than fake progress. */
window.openCurtains = function (ready, onReady, onFallback) {
  const overlay = document.querySelector('#preloader');
  const paper = overlay.querySelector('.intro-paper');
  const ink = overlay.querySelector('.intro-ink');
  const caret = overlay.querySelector('.intro-caret');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap) { overlay.remove(); onFallback(); return; }
  const text = 'Every story begins\nwith a chapter…';
  gsap.set(paper, { opacity: 1, y: 0 });
  let finished = false, timeout;
  const finish = ok => {
    if (finished) return;
    finished = true; clearTimeout(timeout);
    const opening = gsap.timeline({ onComplete: () => {
      overlay.remove(); (ok ? onReady : onFallback)();
    } });
    caret.style.display = 'none';
    opening.to(paper, { opacity: 0, y: reduce ? 0 : -12, duration: reduce ? .15 : .5, ease: 'sine.in' });
    opening.call(() => { document.documentElement.classList.add('scene-ready'); overlay.style.background = 'transparent'; }, null, reduce ? .15 : .35);
    if (reduce) opening.to(overlay, { opacity: 0, duration: .2 });
    else {
      // Gather the velvet toward its outer rail while its free edge bows under tension.
      // Both sides finish together, so the horse starts without an extra pause.
      opening.to('.curtain-left', { xPercent: -101, scaleX: .86, duration: 2.45, ease: 'power1.inOut' }, .35)
        .to('.curtain-right', { xPercent: 101, scaleX: .86, duration: 2.45, ease: 'power1.inOut' }, .35)
        .to('#curtain-edge-left', { attr: { d: 'M0 0 L1 0 C.98 .28 .79 .72 .72 1 L0 1 Z' }, duration: 1.65, ease: 'sine.inOut' }, .35)
        .to('#curtain-edge-right', { attr: { d: 'M1 0 L0 0 C.02 .28 .21 .72 .28 1 L1 1 Z' }, duration: 1.65, ease: 'sine.inOut' }, .35);
    }
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
