import { A11y, Swiper } from './swiper-loader.js';

const instances = new WeakMap();
const CONTROL_EVENTS = ['afterInit', 'fromEdge', 'lock', 'resize', 'slideChange', 'toEdge', 'unlock', 'update'];

const isElement = (value) => value?.nodeType === 1 && typeof value.matches === 'function';

const resolveElements = (target, scope) => {
  if (!target) return [];
  if (isElement(target)) return [target];
  if (typeof target === 'string') return Array.from(scope?.querySelectorAll(target) || []);
  if (Array.isArray(target)) return target.flatMap((item) => resolveElements(item, scope));
  if (typeof target.length === 'number') return Array.from(target).filter(isElement);
  return [];
};

const uniqueModules = (modules) => Array.from(new Set([A11y, ...modules].filter(Boolean)));

const buildSwiperOptions = (options) => {
  const { modules = [], ...swiperOptions } = options;
  const normalizedModules = Array.isArray(modules) ? modules : [modules];

  return {
    modules: uniqueModules(normalizedModules),
    watchOverflow: true,
    ...swiperOptions,
    a11y: {
      enabled: true,
      ...(swiperOptions.a11y || {})
    }
  };
};

const setControlState = (control, disabled, locked = false) => {
  if ('disabled' in control) control.disabled = disabled;
  control.setAttribute('aria-disabled', String(disabled));
  control.classList.toggle('swiper-button-disabled', disabled && !locked);
  control.classList.toggle('swiper-button-lock', locked);
};

const getSwiperFromTarget = (target) => {
  if (!target) return null;
  if (target.el) return target;
  if (isElement(target)) return instances.get(target)?.swiper || target.swiper || null;
  return null;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Binds the theme's shared interval-based autoplay contract to any Swiper
 * instance. The returned cleanup function is safe to call during editor
 * section unloads and component disconnects.
 */
export const bindSwiperAutoplay = (swiper, settings = {}) => {
  if (!swiper || swiper.destroyed || prefersReducedMotion()) return () => {};

  const delay = Math.min(60000, Math.max(1000, Number(settings.delay) || 4000));
  const scope = settings.scope || swiper.el;
  const pauseOnHover = settings.pauseOnHover !== false;
  const interval = window.setInterval(() => {
    if (
      document.hidden ||
      swiper.destroyed ||
      swiper.isLocked ||
      (pauseOnHover && swiper.wrapperEl?.matches(':hover')) ||
      scope.contains(document.activeElement)
    ) return;

    swiper.isEnd ? swiper.slideTo(0) : swiper.slideNext();
  }, delay);

  return () => window.clearInterval(interval);
};

export const bindSwiperControls = (swiper, controls = {}) => {
  if (!swiper || swiper.destroyed) return () => {};

  const controlOptions = controls && controls !== true ? controls : {};
  const scope = controlOptions.scope || swiper.el;
  const previousControls = resolveElements(
    controlOptions.previous || '[data-swiper-previous]',
    scope,
  );
  const nextControls = resolveElements(controlOptions.next || '[data-swiper-next]', scope);
  if (!previousControls.length && !nextControls.length) return () => {};

  const controller = new AbortController();
  const eventOptions = { signal: controller.signal };
  const update = () => {
    if (swiper.destroyed) return;

    const isLocked = Boolean(swiper.isLocked);
    const isLooping = Boolean(swiper.params.loop || controlOptions.loop);
    const previousDisabled = isLocked || (!isLooping && swiper.isBeginning);
    const nextDisabled = isLocked || (!isLooping && swiper.isEnd);

    previousControls.forEach((control) => {
      setControlState(control, previousDisabled, isLocked);
      if (swiper.el.id) control.setAttribute('aria-controls', swiper.el.id);
    });
    nextControls.forEach((control) => {
      setControlState(control, nextDisabled, isLocked);
      if (swiper.el.id) control.setAttribute('aria-controls', swiper.el.id);
    });
  };

  previousControls.forEach((control) => {
    control.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') return;
      swiper.slidePrev();
    }, eventOptions);
  });
  nextControls.forEach((control) => {
    control.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') return;
      swiper.slideNext();
    }, eventOptions);
  });

  CONTROL_EVENTS.forEach((eventName) => {
    swiper.on(eventName, update);
  });

  update();
  return () => {
    controller.abort();
    CONTROL_EVENTS.forEach((eventName) => {
      swiper.off(eventName, update);
    });
  };
};

/**
 * Binds a scoped set of buttons to individual Swiper slides. The caller owns
 * the button markup and supplies each target index through a data attribute.
 */
export const bindSwiperSlideControls = (swiper, controls = {}) => {
  if (!swiper || swiper.destroyed) return () => {};

  const controlOptions = controls && controls !== true ? controls : {};
  const scope = controlOptions.scope || swiper.el;
  const selector = controlOptions.selector || '[data-swiper-slide-index]';
  const indexAttribute = controlOptions.indexAttribute || 'data-swiper-slide-index';
  const activeClass = controlOptions.activeClass || 'is-active';
  const currentValue = controlOptions.currentValue || 'true';
  const scrollActiveIntoView = Boolean(controlOptions.scrollActiveIntoView);
  const controller = new AbortController();
  let previousActiveIndex = null;

  const getControls = () => Array.from(scope.querySelectorAll(selector));
  const getControlIndex = (control) => {
    const value = control.getAttribute(indexAttribute);
    return value === null ? Number.NaN : Number(value);
  };
  const update = () => {
    if (swiper.destroyed) return;

    const activeIndex = Number.isInteger(swiper.realIndex) ? swiper.realIndex : swiper.activeIndex;
    const activeControl = getControls().find((control) => getControlIndex(control) === activeIndex);
    getControls().forEach((control) => {
      const isActive = control === activeControl;
      if (activeClass) control.classList.toggle(activeClass, isActive);
      if (isActive) control.setAttribute('aria-current', currentValue);
      else control.removeAttribute('aria-current');
    });

    if (scrollActiveIntoView && activeControl && previousActiveIndex !== null && activeIndex !== previousActiveIndex) {
      activeControl.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
    previousActiveIndex = activeIndex;
  };

  scope.addEventListener('click', (event) => {
    const control = event.target.closest?.(selector);
    if (!control || !scope.contains(control)) return;

    const index = getControlIndex(control);
    if (!Number.isInteger(index) || index < 0 || index >= swiper.slides.length) return;
    event.preventDefault();
    if (index !== swiper.realIndex) {
      if (swiper.params.loop && typeof swiper.slideToLoop === 'function') {
        swiper.slideToLoop(index, swiper.params.speed);
      } else {
        swiper.slideTo(index, swiper.params.speed);
      }
    }
  }, { signal: controller.signal });

  const updateEvents = ['activeIndexChange', 'slideChangeTransitionEnd', 'slidesUpdated', 'update'];
  updateEvents.forEach((eventName) => swiper.on(eventName, update));
  update();

  return () => {
    controller.abort();
    updateEvents.forEach((eventName) => swiper.off(eventName, update));
  };
};

export const createSwiperCarousel = (element, options = {}) => {
  if (!isElement(element) || element.dataset.swiperLayout === 'grid') return null;

  const existing = getSwiperFromTarget(element);
  if (existing && !existing.destroyed) return existing;

  const { controls, ...swiperOptions } = options;
  const swiper = new Swiper(element, buildSwiperOptions(swiperOptions));
  const controlsCleanup = controls ? bindSwiperControls(swiper, controls) : null;
  instances.set(element, { controlsCleanup, swiper });
  element.dataset.swiperReady = 'true';
  return swiper;
};

export const updateSwiperCarousel = (target) => {
  const swiper = getSwiperFromTarget(target);
  if (!swiper || swiper.destroyed) return null;
  swiper.update();
  return swiper;
};

export const destroySwiperCarousel = (target, deleteInstance = true, cleanupStyles = true) => {
  const element = target?.el || (isElement(target) ? target : null);
  const record = element ? instances.get(element) : null;
  const swiper = record?.swiper || getSwiperFromTarget(target);

  record?.controlsCleanup?.();
  if (swiper && !swiper.destroyed) swiper.destroy(deleteInstance, cleanupStyles);
  if (element) {
    delete element.dataset.swiperReady;
    instances.delete(element);
  }

  return null;
};

export const getSwiperCarousel = getSwiperFromTarget;
