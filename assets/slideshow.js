import { EffectFade, Pagination } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

const states = new WeakMap();
const selector = '[data-slideshow]';
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isVisible = (element) => element.getClientRects().length > 0;
const slideSelector = '[data-slideshow-slide]';
const controlSchemeEvents = ['activeIndexChange', 'slideChangeTransitionEnd', 'update', 'resize'];

const createSlideClone = (slide, sourceIndex, position) => {
  const clone = slide.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('data-slideshow-slide');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('data-slideshow-clone', position);
  clone.setAttribute('data-slideshow-clone-source', String(sourceIndex));
  clone.classList.remove('swiper-slide-active', 'swiper-slide-next', 'swiper-slide-prev', 'swiper-slide-visible', 'swiper-slide-fully-visible');
  clone.classList.add('swiper-slide-clone');
  clone.querySelectorAll('[id], [data-shopify-editor-block], [data-shopify-editor-block-id], [data-shopify-editor-block-type]').forEach((element) => {
    element.removeAttribute('id');
    element.removeAttribute('data-shopify-editor-block');
    element.removeAttribute('data-shopify-editor-block-id');
    element.removeAttribute('data-shopify-editor-block-type');
  });
  clone.querySelectorAll('a, button, input, select, textarea, summary, video').forEach((element) => {
    element.setAttribute('tabindex', '-1');
    element.setAttribute('aria-hidden', 'true');
  });
  if ('inert' in clone) clone.inert = true;
  return clone;
};

const createPageWidthLoop = (carousel, slideCount) => {
  const wrapper = carousel.querySelector('.swiper-wrapper');
  const slides = wrapper ? [...wrapper.querySelectorAll(`:scope > ${slideSelector}`)] : [];
  if (slides.length !== slideCount || slideCount < 2) return null;

  // Keep a complete cycle at BOTH ends: A' B' C' | A B C | A' B' C'.
  // The clone reached during wrapping must itself have both neighbours so
  // the visible page-width edges are identical before and after the reset.
  const before = slides.map((slide, index) => createSlideClone(slide, index, 'previous'));
  const after = slides.map((slide, index) => createSlideClone(slide, index, 'next'));
  wrapper.prepend(...before);
  wrapper.append(...after);
  let resetSlide = null;

  return {
    initialSlide: slideCount,
    logicalIndex: (activeIndex) => activeIndex % slideCount,
    originalIndex: (logicalIndex) => logicalIndex + slideCount,
    restore(swiper) {
      if (swiper.destroyed) return;
      const targetIndex = swiper.activeIndex < slideCount || swiper.activeIndex >= slideCount * 2
        ? slideCount + (swiper.activeIndex % slideCount) : null;
      if (targetIndex === null) return;
      resetSlide = swiper.slides[targetIndex];
      resetSlide?.classList.add('slideshow-slide--loop-reset');
      swiper.slideTo(targetIndex, 0, false);
    },
    clearReset() {
      if (resetSlide?.classList.contains('swiper-slide-active')) return;
      resetSlide?.classList.remove('slideshow-slide--loop-reset');
      resetSlide = null;
    },
    destroy() {
      resetSlide?.classList.remove('slideshow-slide--loop-reset');
      [...before, ...after].forEach((clone) => clone.remove());
    },
  };
};

const updateParallax = (root) => {
  if (reducedMotion()) return;
  root.querySelectorAll(`.swiper-wrapper > ${slideSelector}`).forEach((slide) => {
    const media = slide.querySelector('[data-slideshow-media]');
    const effect = slide.dataset.parallax;
    if (!media || !effect || effect === 'none') return;
    const bounds = slide.getBoundingClientRect();
    const progress = Math.max(-1, Math.min(1, ((window.innerHeight / 2) - (bounds.top + (bounds.height / 2))) / Math.max(bounds.height, 1)));
    if (effect === 'vertical') media.style.transform = `translate3d(0, ${Math.round(progress * 32)}px, 0) scale(1.08)`;
    if (effect === 'horizontal') media.style.transform = `translate3d(${Math.round(progress * 32)}px, 0, 0) scale(1.08)`;
    if (effect === 'zoom') media.style.transform = `scale(${(1.04 + Math.abs(progress) * 0.08).toFixed(3)})`;
  });
};

const paginationOptions = (root) => {
  const element = root.querySelector('[data-slideshow-pagination]');
  if (!element || element.dataset.paginationType === 'progress_bar' || element.dataset.paginationType === 'numbers') return {};
  return {
    pagination: {
      el: element,
      type: 'bullets',
      clickable: true,
    },
  };
};

const normalizePaginationIndex = (index, slideCount) => {
  const numericIndex = Number(index);
  if (!Number.isFinite(numericIndex) || slideCount < 1) return 0;
  return ((numericIndex % slideCount) + slideCount) % slideCount;
};

const createSegmentedPagination = (root, swiper, loop, slideCount) => {
  const element = root.querySelector('[data-slideshow-pagination]');
  if (!element || element.dataset.paginationType !== 'progress_bar' || slideCount < 1) return null;

  const controller = new AbortController();
  const controlsId = carouselId(swiper);
  const paginationBulletMessage = swiper.params.a11y?.paginationBulletMessage || 'Go to slide {{index}}';
  const segments = Array.from({ length: slideCount }, (_, index) => {
    const segment = document.createElement('button');
    segment.className = 'slideshow__pagination-segment';
    segment.type = 'button';
    segment.dataset.slideshowPaginationIndex = String(index);
    segment.setAttribute('aria-label', paginationBulletMessage.replace('{{index}}', String(index + 1)));
    if (controlsId) segment.setAttribute('aria-controls', controlsId);

    const fill = document.createElement('span');
    fill.className = 'slideshow__pagination-segment-fill';
    fill.setAttribute('aria-hidden', 'true');
    segment.append(fill);
    return segment;
  });

  element.replaceChildren(...segments);

  const getCurrentIndex = () => {
    const currentIndex = loop
      ? loop.logicalIndex(swiper.activeIndex)
      : swiper.params.loop
        ? swiper.realIndex
        : swiper.activeIndex;
    return normalizePaginationIndex(currentIndex, slideCount);
  };

  const update = () => {
    if (swiper.destroyed) return;
    const currentIndex = getCurrentIndex();
    segments.forEach((segment, index) => {
      const active = index === currentIndex;
      segment.classList.toggle('slideshow__pagination-segment--active', active);
      if (active) segment.setAttribute('aria-current', 'true');
      else segment.removeAttribute('aria-current');
    });
  };

  const goTo = (index) => {
    const targetIndex = normalizePaginationIndex(index, slideCount);
    if (loop) swiper.slideTo(loop.originalIndex(targetIndex));
    else if (swiper.params.loop) swiper.slideToLoop(targetIndex);
    else swiper.slideTo(targetIndex);
  };

  element.addEventListener('click', (event) => {
    const segment = event.target?.closest?.('[data-slideshow-pagination-index]');
    if (!segment || !element.contains(segment)) return;
    event.preventDefault();
    if (swiper.destroyed || swiper.animating) return;
    goTo(segment.dataset.slideshowPaginationIndex);
  }, { signal: controller.signal });

  const paginationEvents = ['activeIndexChange', 'realIndexChange', 'slideChangeTransitionEnd'];
  paginationEvents.forEach((eventName) => swiper.on(eventName, update));
  update();

  return {
    destroy() {
      controller.abort();
      paginationEvents.forEach((eventName) => swiper.off(eventName, update));
      element.replaceChildren();
    },
  };
};

const createNumberedPagination = (root, swiper, loop, slideCount) => {
  const element = root.querySelector('[data-slideshow-pagination]');
  if (!element || element.dataset.paginationType !== 'numbers' || slideCount < 1) return null;

  const controller = new AbortController();
  const controlsId = carouselId(swiper);
  const paginationBulletMessage = swiper.params.a11y?.paginationBulletMessage || 'Go to slide {{index}}';
  const numbers = Array.from({ length: slideCount }, (_, index) => {
    const number = document.createElement('button');
    number.className = 'slideshow__pagination-number body-text body-lg';
    number.type = 'button';
    number.dataset.slideshowPaginationIndex = String(index);
    number.setAttribute('aria-label', paginationBulletMessage.replace('{{index}}', String(index + 1)));
    number.setAttribute('aria-current', 'false');
    if (controlsId) number.setAttribute('aria-controls', controlsId);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.setProperty('--percent', '0');

    const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', '50%');
    backgroundCircle.setAttribute('cy', '50%');
    backgroundCircle.setAttribute('r', '15');

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', '50%');
    progressCircle.setAttribute('cy', '50%');
    progressCircle.setAttribute('r', '15');
    progressCircle.style.setProperty('stroke-dasharray', '93.6404px, 93.6404px');

    svg.append(backgroundCircle, progressCircle);

    const label = document.createElement('span');
    label.textContent = String(index + 1);
    number.append(svg, label);
    return number;
  });

  element.replaceChildren(...numbers);

  const getCurrentIndex = () => {
    const currentIndex = loop
      ? loop.logicalIndex(swiper.activeIndex)
      : swiper.params.loop
        ? swiper.realIndex
        : swiper.activeIndex;
    return normalizePaginationIndex(currentIndex, slideCount);
  };

  const update = () => {
    if (swiper.destroyed) return;
    const currentIndex = getCurrentIndex();
    const autoplayProgress = root.style.getPropertyValue('--slideshow-autoplay-progress').trim();
    const hasAutoplayClock = autoplayProgress !== '';
    const progress = hasAutoplayClock ? Math.max(0, Math.min(1, Number(autoplayProgress) || 0)) : 1;
    numbers.forEach((number, index) => {
      const active = index === currentIndex;
      number.classList.toggle('slideshow__pagination-number--active', active);
      number.setAttribute('aria-current', active ? 'true' : 'false');
      number.querySelector('svg')?.style.setProperty('--percent', active ? String(progress) : '0');
    });
  };

  const goTo = (index) => {
    const targetIndex = normalizePaginationIndex(index, slideCount);
    if (loop) swiper.slideTo(loop.originalIndex(targetIndex));
    else if (swiper.params.loop) swiper.slideToLoop(targetIndex);
    else swiper.slideTo(targetIndex);
  };

  element.addEventListener('click', (event) => {
    const number = event.target?.closest?.('[data-slideshow-pagination-index]');
    if (!number || !element.contains(number)) return;
    event.preventDefault();
    if (swiper.destroyed || swiper.animating) return;
    goTo(number.dataset.slideshowPaginationIndex);
  }, { signal: controller.signal });

  const paginationEvents = ['activeIndexChange', 'realIndexChange', 'slideChangeTransitionEnd'];
  paginationEvents.forEach((eventName) => swiper.on(eventName, update));
  update();

  return {
    destroy() {
      controller.abort();
      paginationEvents.forEach((eventName) => swiper.off(eventName, update));
      element.replaceChildren();
    },
  };
};

const createLoopPagination = (root, swiper, loop, slideCount) => {
  const element = root.querySelector('[data-slideshow-pagination]');
  if (!element || !loop) return null;
  const type = element.dataset.paginationType;
  if (type === 'progress_bar') return createSegmentedPagination(root, swiper, loop, slideCount);
  if (type === 'numbers') return createNumberedPagination(root, swiper, loop, slideCount);
  const controller = new AbortController();
  const update = () => {
    const current = loop.logicalIndex(swiper.activeIndex);
    element.querySelectorAll('[data-slideshow-pagination-index]').forEach((bullet) => {
      bullet.classList.toggle('swiper-pagination-bullet-active', Number(bullet.dataset.slideshowPaginationIndex) === current);
    });
  };

  if (type === 'bullets') {
    element.innerHTML = Array.from({ length: slideCount }, (_, index) => `<button class="swiper-pagination-bullet" type="button" data-slideshow-pagination-index="${index}" aria-label="Go to slide ${index + 1}"></button>`).join('');
    element.addEventListener('click', (event) => {
      const bullet = event.target.closest('[data-slideshow-pagination-index]');
      if (!bullet) return;
      event.preventDefault();
      swiper.slideTo(loop.originalIndex(Number(bullet.dataset.slideshowPaginationIndex)));
    }, { signal: controller.signal });
  }
  swiper.on('activeIndexChange', update);
  update();
  return {
    destroy() {
      controller.abort();
      swiper.off('activeIndexChange', update);
      element.replaceChildren();
    },
  };
};

const startAutoplay = (root, swiper, loop) => {
  if (root.dataset.autoplay !== 'true' || reducedMotion()) return null;
  const delay = Math.min(60000, Math.max(3000, Number(root.dataset.autoplayDelay) || 6000));
  const pauseOnHover = root.dataset.pauseOnHover !== 'false';

  const index = () => loop ? loop.logicalIndex(swiper.activeIndex) : swiper.realIndex;
  let current = index();
  let elapsed = 0;
  let previous = null;
  let frame = 0;
  let touching = false;
  const paint = () => {
    const progress = Math.max(0, Math.min(1, elapsed / delay));
    root.style.setProperty('--slideshow-autoplay-progress', String(progress));
    root.querySelectorAll('[data-slideshow-pagination][data-pagination-type="numbers"] .slideshow__pagination-number').forEach((number) => {
      number.querySelector('svg')?.style.setProperty('--percent', number.getAttribute('aria-current') === 'true' ? String(progress) : '0');
    });
  };
  const reset = () => {
    // Moving from a clone to its original is still the same logical slide.
    if (current === index()) return;
    current = index();
    elapsed = 0;
    previous = null;
    paint();
  };
  const touchStart = () => { touching = true; previous = null; };
  const touchEnd = () => { touching = false; previous = null; };
  const visibilityChange = () => { previous = null; };
  const tick = (now) => {
    const paused = document.hidden || !isVisible(root) || reducedMotion() ||
      (pauseOnHover && root.matches(':hover')) ||
      Boolean(root.querySelector(':focus-visible')) || touching || swiper.isLocked || swiper.animating;
    if (paused) previous = null;
    else {
      if (previous !== null) elapsed = Math.min(delay, elapsed + now - previous);
      previous = now;
      paint();
      if (elapsed >= delay) {
        elapsed = 0;
        previous = null;
        swiper.slideNext();
        paint();
      }
    }
    frame = window.requestAnimationFrame(tick);
  };
  // The timer and both pagination styles share one clock, including pauses.
  swiper.on('activeIndexChange realIndexChange', reset);
  swiper.on('touchStart', touchStart);
  swiper.on('touchEnd', touchEnd);
  document.addEventListener('visibilitychange', visibilityChange);
  paint();
  frame = window.requestAnimationFrame(tick);
  return {
    destroy() {
      window.cancelAnimationFrame(frame);
      swiper.off('activeIndexChange realIndexChange', reset);
      swiper.off('touchStart', touchStart);
      swiper.off('touchEnd', touchEnd);
      document.removeEventListener('visibilitychange', visibilityChange);
      root.style.removeProperty('--slideshow-autoplay-progress');
    },
  };
};

const bindNavigation = (root, swiper) => {
  const controller = new AbortController();
  const options = { capture: true, signal: controller.signal };
  const previous = root.querySelector('[data-slideshow-previous]');
  const next = root.querySelector('[data-slideshow-next]');
  const move = (direction) => (event) => {
    event.preventDefault();
    if (swiper.destroyed || swiper.animating) return;
    if (direction < 0) swiper.slidePrev();
    else swiper.slideNext();
  };

  previous?.addEventListener('click', move(-1), options);
  next?.addEventListener('click', move(1), options);
  [previous, next].filter(Boolean).forEach((control) => control.setAttribute('aria-controls', carouselId(swiper)));
  return controller;
};

const carouselId = (swiper) => swiper.el.id || '';

const updateControlScheme = (root, swiper) => {
  if (swiper.destroyed) return;

  const activeSlide = swiper.slides?.[swiper.activeIndex] || root.querySelector('.swiper-wrapper > .swiper-slide-active');
  const scheme = activeSlide?.dataset.slideshowColorScheme?.trim() || '';
  // Controls live outside the slides. Apply the active slide's scheme to both
  // control surfaces instead of letting them inherit the section-level fallback.
  root.querySelectorAll('[data-slideshow-control-scope]').forEach((control) => {
    const previousScheme = control.dataset.slideshowControlScheme;
    if (previousScheme && previousScheme !== scheme) control.classList.remove(previousScheme);

    if (scheme) {
      control.classList.add(scheme);
      control.dataset.slideshowControlScheme = scheme;
    } else {
      delete control.dataset.slideshowControlScheme;
    }
  });
};

const init = (root) => {
  if (!(root instanceof HTMLElement) || states.has(root)) return;
  const carousel = root.querySelector('[data-slideshow-swiper]');
  if (!carousel) return;
  const pageWidth = root.classList.contains('slideshow--width-page');
  const showNextSlidePreview = pageWidth && root.dataset.showNextSlidePreviewOnDesktop === 'true';
  const slideCount = carousel.querySelectorAll(`.swiper-wrapper > ${slideSelector}`).length;
  const pageWidthLoop = showNextSlidePreview && slideCount > 1;
  const manualLoop = pageWidthLoop ? createPageWidthLoop(carousel, slideCount) : null;
  // Adjacent page-width slides require Swiper's slide effect.
  const fade = !showNextSlidePreview && root.dataset.transition === 'fade';
  const autoplay = root.dataset.autoplay === 'true' && !reducedMotion();
  const paginationType = root.querySelector('[data-slideshow-pagination]')?.dataset.paginationType;
  const paginationModules = paginationType === 'progress_bar' || paginationType === 'numbers' ? [] : [Pagination];
  const options = {
    modules: manualLoop ? [] : (fade ? [EffectFade, ...paginationModules] : paginationModules),
    slidesPerView: 1,
    // Keep preview slides visually separate while letting Swiper include the gap
    // in its translate, drag, loop, and pagination calculations.
    spaceBetween: showNextSlidePreview ? 24 : 0,
    centeredSlides: showNextSlidePreview,
    loop: !manualLoop && slideCount > 1,
    initialSlide: manualLoop?.initialSlide || 0,
    // Finish the transition and clone reset before accepting another move.
    // Otherwise rapid input can advance past the buffered loop neighbours.
    preventInteractionOnTransition: true,
    watchOverflow: true,
    speed: reducedMotion() ? 0 : 600,
    effect: fade ? 'fade' : 'slide',
    fadeEffect: fade ? { crossFade: true } : undefined,
    ...(manualLoop ? {} : paginationOptions(root)),
  };
  const swiper = createSwiperCarousel(carousel, options);
  if (!swiper) {
    manualLoop?.destroy();
    return;
  }
  const customPagination = manualLoop
    ? createLoopPagination(root, swiper, manualLoop, slideCount)
    : paginationType === 'numbers'
      ? createNumberedPagination(root, swiper, null, slideCount)
      : createSegmentedPagination(root, swiper, null, slideCount);
  if (manualLoop) {
    swiper.on('slideChangeTransitionEnd', manualLoop.restore);
    swiper.on('slideChangeTransitionStart', manualLoop.clearReset);
  }
  const syncControlScheme = () => updateControlScheme(root, swiper);
  controlSchemeEvents.forEach((eventName) => swiper.on(eventName, syncControlScheme));
  syncControlScheme();
  const navigationController = bindNavigation(root, swiper);
  const autoplayController = autoplay ? startAutoplay(root, swiper, manualLoop) : null;
  let frame = 0;
  const scheduleParallax = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; updateParallax(root); });
  };
  window.addEventListener('scroll', scheduleParallax, { passive: true });
  swiper.on('slideChangeTransitionEnd', scheduleParallax);
  scheduleParallax();
  const updateLockedState = () => root.classList.toggle('slideshow--single-slide', Boolean(swiper.isLocked));
  swiper.on('lock unlock update resize', updateLockedState);
  updateLockedState();
  states.set(root, { carousel, swiper, scheduleParallax, frame, autoplayController, navigationController, updateLockedState, manualLoop, customPagination, syncControlScheme });
};

const destroy = (root) => {
  const state = states.get(root);
  if (!state) return;
  window.removeEventListener('scroll', state.scheduleParallax);
  if (state.frame) window.cancelAnimationFrame(state.frame);
  state.autoplayController?.destroy();
  state.navigationController.abort();
  state.customPagination?.destroy();
  if (state.manualLoop) {
    state.swiper.off('slideChangeTransitionEnd', state.manualLoop.restore);
    state.swiper.off('slideChangeTransitionStart', state.manualLoop.clearReset);
    state.manualLoop.destroy();
  }
  controlSchemeEvents.forEach((eventName) => state.swiper.off(eventName, state.syncControlScheme));
  state.swiper.off('lock unlock update resize', state.updateLockedState);
  destroySwiperCarousel(state.swiper);
  states.delete(root);
};

const initWithin = (root = document) => {
  if (root.matches?.(selector)) init(root);
  root.querySelectorAll?.(selector).forEach(init);
};
const destroyWithin = (root) => {
  if (root.matches?.(selector)) destroy(root);
  root.querySelectorAll?.(selector).forEach(destroy);
};

document.addEventListener('shopify:section:load', (event) => initWithin(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyWithin(event.target));
document.addEventListener('shopify:block:select', (event) => {
  const root = event.target.closest?.(selector);
  const state = root && states.get(root);
  const slide = event.target.closest?.('[data-slideshow-slide]');
  // The page-width loop adds inert clones to the wrapper. Keep editor
  // selection mapped to its logical source slides.
  const slides = state?.carousel.querySelectorAll('.swiper-wrapper > [data-slideshow-slide]');
  const index = slides ? [...slides].indexOf(slide) : -1;
  if (state && slide && index >= 0) state.swiper.slideTo(state.manualLoop?.originalIndex(index) ?? index);
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initWithin(), { once: true });
else initWithin();
