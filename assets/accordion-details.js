(() => {
  const controllerKey = '__themeAccordionDetailsController';
  if (window[controllerKey]) return;

  const detailsSelector = '[data-accordion-details]';
  const desktopBreakpoint = '(min-width: 768px)';
  const states = new WeakMap();

  const verticalInsets = (element) => {
    const style = getComputedStyle(element);
    return ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
      .reduce((total, property) => total + (Number.parseFloat(style[property]) || 0), 0);
  };

  const cssHeight = (element, borderBoxHeight) => Math.max(0, borderBoxHeight
    - (getComputedStyle(element).boxSizing === 'border-box' ? 0 : verticalInsets(element)));

  const listenToMediaQuery = (mediaQuery, callback, signal) => {
    if (!mediaQuery) return;

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', callback);
      signal.addEventListener('abort', () => mediaQuery.removeEventListener('change', callback), { once: true });
      return;
    }

    mediaQuery.addListener(callback);
    signal.addEventListener('abort', () => mediaQuery.removeListener(callback), { once: true });
  };

  const updateAccessibilityState = (state) => {
    state.details.dataset.accordionState = state.isOpen ? 'open' : 'closed';
    state.summary.setAttribute('aria-expanded', String(state.isOpen));
  };

  const readDeclaredOpenState = (details) => {
    if (details.dataset.accordionState === 'open') return true;
    if (details.dataset.accordionState === 'closed') return false;
    return details.open;
  };

  const readMobileOpenState = (details) => {
    if (details.dataset.accordionMobileState === 'open') return true;
    if (details.dataset.accordionMobileState === 'closed') return false;
    return readDeclaredOpenState(details);
  };

  const clearAnimationStyles = (state) => {
    [state.details, state.content].forEach((element) => {
      element.style.removeProperty('height');
      element.style.removeProperty('max-height');
      element.style.removeProperty('overflow');
      element.style.removeProperty('opacity');
      element.style.removeProperty('visibility');
      element.style.removeProperty('transform');
    });
  };

  const notifyStateChange = (state) => {
    state.details.dispatchEvent(
      new CustomEvent('accordion:state-change', {
        detail: { open: state.isOpen }
      })
    );
  };

  const cancelAnimations = (state, preserveVisualState = true) => {
    if (state.animations.length && preserveVisualState) {
      state.details.style.height = `${cssHeight(state.details, state.details.getBoundingClientRect().height)}px`;
      state.content.style.opacity = getComputedStyle(state.content).opacity;
      state.content.style.transform = getComputedStyle(state.content).transform;
    }

    state.animations.forEach((animation) => animation.cancel());
    state.animations = [];
    state.animationId += 1;
  };

  const setStaticState = (state, isOpen) => {
    cancelAnimations(state, false);
    state.isOpen = Boolean(isOpen);
    state.details.open = state.isOpen;
    updateAccessibilityState(state);
    clearAnimationStyles(state);
  };

  const setMobileState = (state, isOpen) => {
    if (!state.mobileOnly) return;

    state.mobileOpen = Boolean(isOpen);
    state.details.dataset.accordionMobileState = state.mobileOpen ? 'open' : 'closed';
  };

  const applyResponsiveState = (state) => {
    if (!state.mobileOnly) return;

    state.isDesktop = state.desktopQuery.matches;
    setStaticState(state, state.isDesktop || state.mobileOpen);
  };

  const finishAnimation = (state, animationId) => {
    if (state.animationId !== animationId) return;

    state.animations.forEach((animation) => animation.cancel());
    state.animations = [];
    state.details.open = state.isOpen;
    updateAccessibilityState(state);
    clearAnimationStyles(state);
  };

  const animateState = (state, isOpen) => {
    const { details, summary, content } = state;
    cancelAnimations(state);

    if (
      typeof details.animate !== 'function' ||
      typeof content.animate !== 'function' ||
      !details.isConnected ||
      state.reducedMotionQuery.matches
    ) {
      setStaticState(state, isOpen);
      return;
    }

    details.style.overflow = 'hidden';

    try {
      const animations = [];

      if (isOpen) {
        const startHeight = cssHeight(details, details.getBoundingClientRect().height);
        details.style.height = `${startHeight}px`;
        details.open = true;

        // Measure the natural border box, including caller-owned padding/borders.
        details.style.removeProperty('height');
        const endHeight = cssHeight(details, details.getBoundingClientRect().height);
        details.style.height = `${startHeight}px`;
        const startOpacity = 0;
        const startTransform = 'translateY(10px)';
        content.style.opacity = `${startOpacity}`;
        content.style.transform = startTransform;
        details.offsetHeight;

        animations.push(
          details.animate(
            [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
            { duration: 250, easing: 'ease', fill: 'both' }
          ),
          content.animate(
            [
              { opacity: startOpacity, transform: startTransform },
              { opacity: 1, transform: 'translateY(0)' }
            ],
            { duration: 150, fill: 'both' }
          )
        );
      } else {
        if (!details.open) details.open = true;

        const startHeight = cssHeight(details, details.getBoundingClientRect().height);
        const endHeight = cssHeight(details, summary.getBoundingClientRect().height + verticalInsets(details));
        const startOpacity = Number.parseFloat(getComputedStyle(content).opacity) || 1;

        animations.push(
          content.animate(
            [{ opacity: startOpacity }, { opacity: 0 }],
            { duration: 150, fill: 'both' }
          ),
          details.animate(
            [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
            { duration: 250, easing: 'ease', fill: 'both' }
          )
        );
      }

      state.animations = animations;
    } catch (error) {
      setStaticState(state, isOpen);
      return;
    }

    const animationId = state.animationId;
    Promise.all(state.animations.map((animation) => animation.finished))
      .then(() => finishAnimation(state, animationId))
      .catch(() => finishAnimation(state, animationId));
  };

  const setOpenState = (state, isOpen) => {
    const nextState = Boolean(isOpen);

    if (state.mobileOnly) {
      if (state.desktopQuery.matches) {
        applyResponsiveState(state);
        return;
      }

      setMobileState(state, nextState);
    }

    if (nextState === state.isOpen && !state.animations.length && state.details.open === nextState) {
      updateAccessibilityState(state);
      return;
    }

    state.isOpen = nextState;
    updateAccessibilityState(state);
    notifyStateChange(state);

    if (state.reducedMotionQuery.matches) {
      setStaticState(state, nextState);
      return;
    }

    animateState(state, nextState);
  };

  const syncExternalState = (state) => {
    const isOpen = readDeclaredOpenState(state.details);

    if (state.mobileOnly) {
      if (!state.desktopQuery.matches) setMobileState(state, isOpen);
      applyResponsiveState(state);
      return;
    }

    setStaticState(state, isOpen);
  };

  const initializeDetails = (details) => {
    if (states.has(details)) return;

    const summary = details.querySelector('summary');
    const content = summary?.nextElementSibling;
    if (!summary || !content) return;

    const controller = new AbortController();
    const mobileOnly = details.hasAttribute('data-accordion-mobile-only');
    const desktopQuery = mobileOnly ? window.matchMedia(desktopBreakpoint) : null;
    const initialOpenState = readDeclaredOpenState(details);
    const initialMobileOpenState = mobileOnly ? readMobileOpenState(details) : initialOpenState;
    const state = {
      animations: [],
      animationId: 0,
      content,
      controller,
      desktopQuery,
      details,
      isDesktop: desktopQuery?.matches ?? false,
      isOpen: initialOpenState,
      mobileOnly,
      mobileOpen: initialMobileOpenState,
      reducedMotionQuery: window.matchMedia('(prefers-reduced-motion: reduce)'),
      summary
    };

    states.set(details, state);

    const eventOptions = { signal: controller.signal };
    summary.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        setOpenState(state, !state.isOpen);
      },
      eventOptions
    );
    details.addEventListener('accordion:sync', () => syncExternalState(state), eventOptions);

    const handleViewportChange = () => {
      if (!state.mobileOnly) return;

      const isDesktop = state.desktopQuery.matches;
      if (state.isDesktop === isDesktop) return;

      state.isDesktop = isDesktop;
      applyResponsiveState(state);
    };

    listenToMediaQuery(desktopQuery, handleViewportChange, controller.signal);
    if (mobileOnly) window.addEventListener('resize', handleViewportChange, eventOptions);

    listenToMediaQuery(
      state.reducedMotionQuery,
      () => {
        if (state.reducedMotionQuery.matches) setStaticState(state, state.isOpen);
      },
      controller.signal
    );

    if (window.Shopify?.designMode) {
      details.addEventListener('shopify:block:select', () => setOpenState(state, true), eventOptions);
      details.addEventListener('shopify:block:deselect', () => setOpenState(state, false), eventOptions);
    }

    if (state.mobileOnly) applyResponsiveState(state);
    else setStaticState(state, state.isOpen);
  };

  const cleanupDetails = (details) => {
    const state = states.get(details);
    if (!state) return;

    state.controller.abort();
    cancelAnimations(state, false);
    clearAnimationStyles(state);
    states.delete(details);
  };

  const initializeRoot = (root = document) => {
    if (root.matches?.(detailsSelector)) initializeDetails(root);
    root.querySelectorAll?.(detailsSelector).forEach(initializeDetails);
  };

  const cleanupRoot = (root) => {
    if (root.matches?.(detailsSelector)) cleanupDetails(root);
    root.querySelectorAll?.(detailsSelector).forEach(cleanupDetails);
  };

  document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
  document.addEventListener('shopify:section:unload', (event) => cleanupRoot(event.target));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
  } else {
    initializeRoot();
  }

  window[controllerKey] = { cleanupRoot, initializeRoot };
})();
