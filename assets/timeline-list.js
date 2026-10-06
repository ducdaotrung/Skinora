import * as swiperCarousel from './swiper-carousel.js';
import { EffectFade } from './swiper-loader.js';

const { createSwiperCarousel, destroySwiperCarousel } = swiperCarousel;
const instances = new WeakMap();
const timelineSelector = '[data-timeline-list]';

const bindTimelineSlideControls = (swiper, options = {}) => {
  if (!swiper || swiper.destroyed) return () => {};

  const scope = options.scope || swiper.el;
  const selector = options.selector || '[data-swiper-slide-index]';
  const controller = new AbortController();
  const getControls = () => Array.from(scope.querySelectorAll(selector));
  let previousActiveIndex = null;
  const update = () => {
    if (swiper.destroyed) return;
    const activeIndex = Number.isInteger(swiper.realIndex) ? swiper.realIndex : swiper.activeIndex;
    const activeControl = getControls().find((control) =>
      Number(control.getAttribute('data-swiper-slide-index')) === activeIndex,
    );
    getControls().forEach((control) => {
      const active = control === activeControl;
      control.classList.toggle('is-active', active);
      if (active) control.setAttribute('aria-current', options.currentValue || 'step');
      else control.removeAttribute('aria-current');
    });

    if (options.scrollActiveIntoView && activeControl && previousActiveIndex !== null && activeIndex !== previousActiveIndex) {
      activeControl.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    previousActiveIndex = activeIndex;
  };

  scope.addEventListener('click', (event) => {
    const control = event.target.closest?.(selector);
    if (!control || !scope.contains(control)) return;
    const index = Number(control.getAttribute('data-swiper-slide-index'));
    if (!Number.isInteger(index) || index < 0 || index >= swiper.slides.length) return;
    event.preventDefault();
    if (index !== swiper.realIndex) swiper.slideTo(index, swiper.params.speed);
  }, { signal: controller.signal });

  const updateEvents = ['activeIndexChange', 'slideChangeTransitionEnd', 'slidesUpdated', 'update'];
  updateEvents.forEach((eventName) => swiper.on(eventName, update));
  update();
  return () => {
    controller.abort();
    updateEvents.forEach((eventName) => swiper.off(eventName, update));
  };
};

const bindSwiperControls = swiperCarousel.bindSwiperControls;
const bindSwiperSlideControls = swiperCarousel.bindSwiperSlideControls || bindTimelineSlideControls;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const numberFromData = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTimelineItems = (viewport) =>
  Array.from(viewport.querySelectorAll(':scope > .swiper-wrapper > .carousel-slide.swiper-slide'));

const getTimelineList = (target) => {
  if (!target) return null;
  if (target.matches?.(timelineSelector)) return target;
  return target.closest?.(timelineSelector) || null;
};

const setActiveSlide = (state, slide) => {
  if (!slide || !state.root.contains(slide)) return;
  const index = getTimelineItems(state.viewport).indexOf(slide);
  if (index < 0 || index === state.swiper.realIndex) return;
  state.swiper.slideTo(index, state.swiper.params.speed);
};

const updatePaginationProgress = (state, items) => {
  const list = state.root.querySelector('[data-timeline-navigation-list]');
  if (!list) return;

  const arrowsHeight = state.arrows?.getBoundingClientRect().height || 0;
  if (arrowsHeight > 0) {
    state.controls?.style.setProperty('--timeline-list-arrow-height', `${arrowsHeight}px`);
  }

  const controls = Array.from(list.querySelectorAll('[data-swiper-slide-index]'));
  if (!controls.length) return;

  const position = state.root.dataset.timelinePosition || 'bottom';
  state.position = position;
  const vertical = position === 'left';
  const listRect = list.getBoundingClientRect();
  const origin = vertical ? listRect.top : listRect.left;
  const center = (control) => {
    const rect = control.getBoundingClientRect();
    return (vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2) - origin;
  };
  const currentIndex = Number.isInteger(state.swiper.realIndex)
    ? state.swiper.realIndex
    : state.swiper.activeIndex;
  const activeIndex = Math.max(0, Math.min(currentIndex, controls.length - 1));
  const activeControl = controls[activeIndex];
  const active = center(activeControl);
  const trackLength = vertical ? listRect.height : listRect.width;
  const progressLength = Math.min(trackLength, Math.max(0, active));
  const sliderLength = trackLength / controls.length;
  const sliderStart = sliderLength * activeIndex;
  const activeLabel = activeControl.querySelector('span');
  const activeLabelRect = activeLabel?.getBoundingClientRect();
  const tabTop = activeLabelRect
    ? vertical
      ? activeControl.getBoundingClientRect().bottom - listRect.top - 1
      : activeLabelRect.bottom - listRect.top + 4
    : listRect.height - 1;

  list.style.setProperty('--timeline-list-track-start', '0px');
  list.style.setProperty('--timeline-list-track-length', `${trackLength}px`);
  list.style.setProperty('--timeline-list-progress-length', `${progressLength}px`);
  list.style.setProperty('--timeline-list-slider-start', `${sliderStart}px`);
  list.style.setProperty('--timeline-list-slider-length', `${sliderLength}px`);
  list.style.setProperty(
    '--timeline-list-tab-start',
    `${activeLabelRect ? activeLabelRect.left - listRect.left : 0}px`,
  );
  list.style.setProperty(
    '--timeline-list-tab-length',
    `${activeLabelRect ? activeLabelRect.width : 0}px`,
  );
  list.style.setProperty('--timeline-list-tab-top', `${tabTop}px`);
};

const scrollActiveControlIntoView = (state, smooth = true) => {
  if (window.innerWidth >= 768 || state.root.dataset.timelinePosition === 'left') return;

  const navigation = state.root.querySelector('[data-timeline-navigation]');
  if (!navigation || navigation.hidden || navigation.scrollWidth <= navigation.clientWidth) return;

  const index = Number.isInteger(state.swiper.realIndex)
    ? state.swiper.realIndex
    : state.swiper.activeIndex;
  const control = navigation.querySelector(`[data-swiper-slide-index="${index}"]`);
  if (!control) return;

  const navigationRect = navigation.getBoundingClientRect();
  const controlRect = control.getBoundingClientRect();
  const distance = (controlRect.left + controlRect.right - navigationRect.left - navigationRect.right) / 2;

  if (Math.abs(distance) > 1) {
    navigation.scrollBy({ left: distance, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  }
};

const renderNavigation = (state, items) => {
  const navigation = state.root.querySelector('[data-timeline-navigation]');
  const list = navigation?.querySelector('[data-timeline-navigation-list]');
  if (!navigation || !list) return;

  const focusedControl = list.querySelector('[data-swiper-slide-index]:focus');
  const focusedSlideId = focusedControl?.getAttribute('aria-controls');
  const labelTemplate = navigation.dataset.timelineLabelTemplate || '';
  const nodes = items.map((item, index) => {
    const timelineLabel = item.dataset.timelineLabel?.trim() || String(index + 1);
    const listItem = document.createElement('li');
    listItem.className = 'timeline-list__navigation-item';

    const button = document.createElement('button');
    button.className = 'timeline-list__control';
    button.type = 'button';
    button.dataset.swiperSlideIndex = String(index);
    button.setAttribute('aria-controls', item.id);
    button.setAttribute(
      'aria-label',
      labelTemplate.replaceAll('__TIMELINE_YEAR__', timelineLabel) || timelineLabel,
    );

    const label = document.createElement('span');
    label.className = 'body-text body-xs';
    label.textContent = timelineLabel;
    button.append(label);
    listItem.append(button);
    return listItem;
  });

  list.replaceChildren(...nodes);
  navigation.hidden = items.length === 0;
  state.controls?.toggleAttribute('hidden', items.length === 0);
  state.arrows?.toggleAttribute('hidden', items.length < 2);
  updatePaginationProgress(state, items);

  if (state.navigation !== navigation) {
    state.navigationCleanup?.();
    state.navigation = navigation;
    state.navigationCleanup = bindSwiperSlideControls(state.swiper, {
      scope: navigation,
      selector: '[data-swiper-slide-index]',
      activeClass: 'is-active',
      currentValue: 'step',
    });
  }

  if (focusedSlideId) {
    const matchingControl = Array.from(list.querySelectorAll('[data-swiper-slide-index]'))
      .find((control) => control.getAttribute('aria-controls') === focusedSlideId);
    matchingControl?.focus({ preventScroll: true });
  }
};

const refresh = (state) => {
  if (!state || state.swiper.destroyed) return;

  state.position = state.root.dataset.timelinePosition || 'bottom';
  const previousSlideId = state.activeSlideId;
  const items = getTimelineItems(state.viewport);
  renderNavigation(state, items);
  state.swiper.update();

  const nextIndex = previousSlideId
    ? items.findIndex((item) => item.id === previousSlideId)
    : -1;
  if (nextIndex >= 0 && nextIndex !== state.swiper.realIndex) {
    state.swiper.slideTo(nextIndex, 0, false);
  } else if (items.length > 0 && state.swiper.realIndex >= items.length) {
    state.swiper.slideTo(items.length - 1, 0, false);
  }

  state.activeSlideId = items[state.swiper.realIndex]?.id || items[0]?.id || null;
  updatePaginationProgress(state, items);
  state.swiper.updateAutoHeight(0);
  scrollActiveControlIntoView(state, false);
};

const initialize = (root) => {
  if (!root || instances.has(root)) return instances.get(root) || null;

  const viewport = root.querySelector('[data-timeline-carousel]');
  if (!viewport) return null;

  const previewDesktop = root.dataset.timelinePreviewDesktop === 'true';
  const previewMobile = root.dataset.timelinePreviewMobile === 'true';
  const transition = root.dataset.timelineTransition === 'fade' ? 'fade' : 'slide';
  const fade = transition === 'fade' && !previewDesktop && !previewMobile;
  const mobileGap = numberFromData(root.dataset.timelineGapMobile, 12);
  const desktopGap = numberFromData(root.dataset.timelineGapDesktop, 16);
  const swiper = createSwiperCarousel(viewport, {
    modules: fade ? [EffectFade] : [],
    effect: fade ? 'fade' : 'slide',
    ...(fade ? { fadeEffect: { crossFade: true } } : {}),
    slidesPerView: fade || !previewMobile ? 1 : 1.5,
    spaceBetween: fade ? 0 : mobileGap,
    ...(!fade
      ? {
          breakpoints: {
            768: {
              slidesPerView: previewDesktop ? 1.5 : 1,
              spaceBetween: desktopGap,
            },
          },
        }
      : {}),
    autoHeight: true,
    preventInteractionOnTransition: true,
    speed: prefersReducedMotion() ? 0 : 400,
  });
  if (!swiper) return null;

  const controller = new AbortController();
  const state = {
    root,
    viewport,
    swiper,
    position: root.dataset.timelinePosition || 'bottom',
    controller,
    activeSlideId: null,
    navigation: null,
    navigationCleanup: null,
    controls: root.querySelector('[data-timeline-controls]'),
    arrows: root.querySelector('[data-timeline-arrows]'),
    arrowsCleanup: null,
    progressObserver: null,
    progressFrame: 0,
    positionObserver: null,
    positionFrame: 0,
  };

  if (typeof ResizeObserver === 'function') {
    state.progressObserver = new ResizeObserver(() => {
      if (state.progressFrame) window.cancelAnimationFrame(state.progressFrame);
      state.progressFrame = window.requestAnimationFrame(() => {
        state.progressFrame = 0;
        const position = root.dataset.timelinePosition || 'bottom';
        if (position !== state.position) {
          state.position = position;
          swiper.update();
        }
        updatePaginationProgress(state, getTimelineItems(viewport));
        scrollActiveControlIntoView(state, false);
      });
    });
    state.progressObserver.observe(viewport);
    if (state.controls) state.progressObserver.observe(state.controls);
  }

  if (typeof MutationObserver === 'function') {
    state.positionObserver = new MutationObserver(() => {
      const position = root.dataset.timelinePosition || 'bottom';
      if (position === state.position) return;
      state.position = position;
      if (state.positionFrame) window.cancelAnimationFrame(state.positionFrame);
      state.positionFrame = window.requestAnimationFrame(() => {
        state.positionFrame = 0;
        if (swiper.destroyed) return;
        swiper.update();
        updatePaginationProgress(state, getTimelineItems(viewport));
        swiper.updateAutoHeight(0);
        scrollActiveControlIntoView(state, false);
      });
    });
    state.positionObserver.observe(root, {
      attributes: true,
      attributeFilter: ['data-timeline-position'],
    });
  }

  if (state.arrows) {
    state.arrowsCleanup = bindSwiperControls(swiper, {
      scope: root,
      previous: '[data-timeline-previous]',
      next: '[data-timeline-next]',
    });
  }

  state.onSlideChange = () => {
    const items = getTimelineItems(viewport);
    state.activeSlideId = items[swiper.realIndex]?.id || null;
    updatePaginationProgress(state, items);
    scrollActiveControlIntoView(state);
  };
  state.onImageLoad = (event) => {
    if (event.target?.matches?.('img')) {
      window.requestAnimationFrame(() => {
        if (!swiper.destroyed) swiper.updateAutoHeight(0);
      });
    }
  };

  swiper.on('slideChange', state.onSlideChange);
  root.addEventListener('load', state.onImageLoad, { capture: true, signal: controller.signal });
  instances.set(root, state);
  refresh(state);
  return state;
};

const initializeRoot = (root = document) => {
  if (root.matches?.(timelineSelector)) initialize(root);
  root.querySelectorAll?.(timelineSelector).forEach(initialize);
};

const destroy = (root) => {
  const state = instances.get(root);
  if (!state) return;

  state.controller.abort();
  state.progressObserver?.disconnect();
  state.positionObserver?.disconnect();
  if (state.progressFrame) window.cancelAnimationFrame(state.progressFrame);
  if (state.positionFrame) window.cancelAnimationFrame(state.positionFrame);
  state.navigationCleanup?.();
  state.arrowsCleanup?.();
  state.swiper.off('slideChange', state.onSlideChange);
  destroySwiperCarousel(state.swiper);
  instances.delete(root);
};

const destroyRoot = (root) => {
  const lists = [];
  if (root.matches?.(timelineSelector)) lists.push(root);
  root.querySelectorAll?.(timelineSelector).forEach((list) => lists.push(list));
  lists.forEach(destroy);
};

const refreshFromEditorEvent = (event) => {
  const root = getTimelineList(event.target);
  if (!root) return;

  const state = instances.get(root) || initialize(root);
  if (!state) return;

  window.requestAnimationFrame(() => refresh(state));
};

const selectTimelineSlide = (event) => {
  const root = getTimelineList(event.target);
  const slide = event.target.closest?.('.carousel-slide.swiper-slide');
  const state = root && instances.get(root);
  if (state && slide) setActiveSlide(state, slide);
};

document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:select', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyRoot(event.target));
document.addEventListener('shopify:block:load', refreshFromEditorEvent);
document.addEventListener('shopify:block:unload', refreshFromEditorEvent);
document.addEventListener('shopify:block:select', selectTimelineSlide);
document.addEventListener('shopify:block:deselect', refreshFromEditorEvent);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
} else {
  initializeRoot();
}
