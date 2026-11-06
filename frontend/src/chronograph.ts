const motion = matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const supported = CSS.supports('transform-style', 'preserve-3d') &&
    'IntersectionObserver' in window && navigator.maxTouchPoints === 0 && !connection?.saveData &&
    (!memory || memory >= 4) && navigator.hardwareConcurrency > 2;

  for (const dial of document.querySelectorAll<HTMLElement>('[data-chronograph-enhancement]')) {
    if (!supported) continue;
    const stage = dial.parentElement;
    const mechanism = dial.querySelector<HTMLElement>('.mechanism');
    if (!stage || !mechanism) continue;
    const stageElement = stage;
    const mechanismElement = mechanism;
    let inView = false;
    let active = false;
    let frame = 0;
    let bounds: DOMRect | undefined;
    let pointerX = 0;
    let pointerY = 0;
    let applied = '';

    const tilt = (ratio: number) => Math.round(80 * Math.max(-1, Math.min(1, ratio))) / 10;

    function invalidateBounds() {
      bounds = undefined;
    }

    function applyTilt() {
      frame = 0;
      if (!active) return;
      bounds ??= stageElement.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const pitch = tilt(1 - 2 * (pointerY - bounds.top) / bounds.height);
      const yaw = tilt(2 * (pointerX - bounds.left) / bounds.width - 1);
      const next = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
      if (next === applied) return;

      mechanismElement.style.transform = next;
      dial.classList.add('is-ready');
      applied = next;
    }

    function queueTilt(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(applyTilt);
    }

    function reset() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      invalidateBounds();
      if (applied) mechanismElement.style.removeProperty('transform');
      applied = '';
      dial.classList.remove('is-ready');
    }

    function sync() {
      const shouldListen = motion.matches && inView && !document.hidden;
      if (shouldListen === active) return;
      active = shouldListen;

      if (active) {
        stageElement.addEventListener('pointermove', queueTilt, { passive: true });
        stageElement.addEventListener('pointerleave', reset);
        window.addEventListener('resize', invalidateBounds);
        window.addEventListener('scroll', invalidateBounds, { passive: true });
      } else {
        stageElement.removeEventListener('pointermove', queueTilt);
        stageElement.removeEventListener('pointerleave', reset);
        window.removeEventListener('resize', invalidateBounds);
        window.removeEventListener('scroll', invalidateBounds);
        reset();
      }
    }

    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(stage);

    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    sync();
  }
