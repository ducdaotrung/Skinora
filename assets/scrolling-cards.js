(() => {
  if (window.__scrollingCardsRuntime) return;
  window.__scrollingCardsRuntime = true;

  const states = new WeakMap();
  const selector = '[data-scrolling-cards]';
  const mobileQuery = window.matchMedia('(max-width: 767.98px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const isMobileStickyDisabled = (root) => mobileQuery.matches && root.dataset.stickyMobile !== 'true';

  const resetTransforms = (cards) => {
    cards.forEach((card) => card.style.removeProperty('transform'));
  };

  const destroy = (root) => {
    const state = states.get(root);
    if (!state) return;

    window.removeEventListener('scroll', state.schedule);
    window.removeEventListener('resize', state.schedule);
    mobileQuery.removeEventListener('change', state.schedule);
    reducedMotionQuery.removeEventListener('change', state.schedule);
    if (state.frame) window.cancelAnimationFrame(state.frame);
    resetTransforms(state.cards);
    states.delete(root);
  };

  const init = (root) => {
    if (!(root instanceof HTMLElement)) return;
    destroy(root);

    const cards = Array.from(root.querySelectorAll(':scope > .scrolling-cards__items > .scrolling-card'));
    if (!cards.length) return;

    const state = {
      cards,
      frame: 0,
      schedule: null
    };

    const update = () => {
      state.frame = 0;

      if (isMobileStickyDisabled(root) || reducedMotionQuery.matches) {
        resetTransforms(cards);
        return;
      }

      const rootBounds = root.getBoundingClientRect();
      const stickyTop = Number.parseFloat(window.getComputedStyle(cards[0]).top) || 0;
      const sectionIsOutsideViewport = rootBounds.bottom <= stickyTop || rootBounds.top >= window.innerHeight;
      if (sectionIsOutsideViewport) {
        resetTransforms(cards);
        return;
      }

      let activeIndex = 0;
      cards.forEach((card, index) => {
        if (card.getBoundingClientRect().top <= stickyTop + 1) activeIndex = index;
      });

      const activeCard = cards[activeIndex];
      const nextCard = cards[activeIndex + 1];
      const activeCardHeight = Math.max(activeCard?.offsetHeight || 1, 1);
      const nextCardTop = nextCard?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const transitionProgress = nextCard
        ? clamp((stickyTop + activeCardHeight - nextCardTop) / activeCardHeight)
        : 0;

      cards.forEach((card, index) => {
        let scale = 1;
        if (index < activeIndex) {
          scale = 1 - Math.min((activeIndex - index) * 0.1, 0.3);
        } else if (index === activeIndex) {
          scale = 1 - transitionProgress * 0.1;
        }
        card.style.transform = 'translateZ(0) scale(' + scale.toFixed(3) + ')';
      });
    };

    state.schedule = () => {
      if (state.frame) return;
      state.frame = window.requestAnimationFrame(update);
    };

    states.set(root, state);
    window.addEventListener('scroll', state.schedule, { passive: true });
    window.addEventListener('resize', state.schedule, { passive: true });
    mobileQuery.addEventListener('change', state.schedule);
    reducedMotionQuery.addEventListener('change', state.schedule);
    state.schedule();
  };

  const initWithin = (root = document) => {
    if (root.matches?.(selector)) init(root);
    root.querySelectorAll?.(selector).forEach(init);
  };

  const destroyWithin = (root) => {
    if (root.matches?.(selector)) destroy(root);
    root.querySelectorAll?.(selector).forEach(destroy);
  };

  const initialize = () => initWithin();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  document.addEventListener('shopify:section:load', (event) => initWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => destroyWithin(event.target));
  document.addEventListener('shopify:section:select', (event) => initWithin(event.target));
  document.addEventListener('shopify:block:select', (event) => {
    const root = event.target.closest?.(selector);
    if (root) init(root);
  });
})();
