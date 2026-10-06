(() => {
  const selector = '[data-images-with-text-scroll]';
  const desktopQuery = window.matchMedia('(min-width: 1000px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = new WeakMap();

  const destroy = (root) => {
    const state = states.get(root);
    if (!state) return;
    state.observer?.disconnect();
    window.removeEventListener('scroll', state.schedule);
    window.removeEventListener('resize', state.schedule);
    root.removeEventListener('scroll', state.mobileScroll);
    state.dotHandlers?.forEach(({ dot, handler }) => dot.removeEventListener('click', handler));
    if (state.interval) window.clearInterval(state.interval);
    if (state.frame) window.cancelAnimationFrame(state.frame);
    states.delete(root);
  };

  const init = (root) => {
    if (!(root instanceof HTMLElement)) return;
    destroy(root);

    const bands = [...root.querySelectorAll('[data-stacked-band]')];
    const content = bands.map((band) => band.querySelector('[data-stacked-band-content]')).filter(Boolean);
    const dots = [...(root.parentElement?.querySelectorAll('[data-images-with-text-scroll-dots] [data-images-with-text-scroll-dot]') || [])];
    if (!bands.length || !content.length) return;

    const activate = (index) => {
      bands.forEach((band, bandIndex) => band.classList.toggle('is-selected', bandIndex === index));
      dots.forEach((dot, dotIndex) => {
        const selected = dotIndex === index;
        dot.classList.toggle('is-active', selected);
        dot.setAttribute('aria-current', selected ? 'true' : 'false');
      });
    };

    if (!desktopQuery.matches) {
      const state = { interval: 0, mobileScroll: null, dotHandlers: [] };
      let activeIndex = 0;

      const activateMobile = (index, shouldScroll = true) => {
        activeIndex = (index + bands.length) % bands.length;
        activate(activeIndex);
        if (shouldScroll) {
          root.scrollTo({
            left: bands[activeIndex].offsetLeft,
            behavior: reducedMotionQuery.matches ? 'auto' : 'smooth'
          });
        }
      };

      const mobileScroll = () => {
        const closestIndex = bands.reduce((closest, band, index) => {
          const distance = Math.abs(band.offsetLeft - root.scrollLeft);
          return distance < closest.distance ? { index, distance } : closest;
        }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
        if (closestIndex !== activeIndex) activateMobile(closestIndex, false);
      };

      dots.forEach((dot, dotIndex) => {
        const handler = (event) => {
          event.preventDefault();
          activateMobile(dotIndex);
        };
        dot.addEventListener('click', handler);
        state.dotHandlers.push({ dot, handler });
      });

      state.mobileScroll = mobileScroll;
      root.addEventListener('scroll', mobileScroll, { passive: true });
      activateMobile(0, false);
      if (bands.length > 1 && root.dataset.autoplayEnabled === 'true' && !reducedMotionQuery.matches) {
        const autoplaySeconds = Math.max(Number.parseFloat(root.dataset.autoplaySeconds) || 4, 1);
        state.interval = window.setInterval(() => activateMobile(activeIndex + 1), autoplaySeconds * 1000);
      }
      states.set(root, state);
      return;
    }

    let activeIndex = 0;
    let frame = 0;
    const state = { observer: null, schedule: null, frame: 0 };

    const update = () => {
      frame = 0;
      state.frame = 0;
      const viewportCenter = window.innerHeight / 2;
      const centeredIndex = content.findIndex((item) => {
        const bounds = item.getBoundingClientRect();
        return bounds.top <= viewportCenter && bounds.bottom >= viewportCenter;
      });

      if (centeredIndex >= 0 && centeredIndex !== activeIndex) {
        activeIndex = centeredIndex;
        activate(activeIndex);
      }
    };

    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
        state.frame = frame;
      }
    };

    const observer = new IntersectionObserver(schedule, { threshold: [0, 1] });
    content.forEach((item) => observer.observe(item));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    activate(0);
    schedule();
    state.observer = observer;
    state.schedule = schedule;
    states.set(root, state);
  };

  const initWithin = (root = document) => {
    if (root.matches?.(selector)) init(root);
    root.querySelectorAll?.(selector).forEach(init);
  };

  const destroyWithin = (root) => {
    if (root.matches?.(selector)) destroy(root);
    root.querySelectorAll?.(selector).forEach(destroy);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initWithin(), { once: true });
  else initWithin();

  document.addEventListener('shopify:section:load', (event) => initWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => destroyWithin(event.target));
  document.addEventListener('shopify:section:select', (event) => initWithin(event.target));
  document.addEventListener('shopify:block:select', (event) => initWithin(event.target.closest?.(selector) || event.target));
  desktopQuery.addEventListener('change', () => initWithin());
})();
