import { Pagination } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

const instances = new WeakMap();
const carouselSelector = '[data-product-carousel][data-layout="carousel"]';
const desktopBreakpoint = 768;

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getCarouselScope = (carousel) =>
  carousel.closest('[data-product-list], [data-blog-list], [data-collection-tab-carousel], [data-collection-card-list]') ||
  carousel.parentElement ||
  carousel;

const getSlidesPerView = (value) => {
  const slidesPerView = Math.min(6, toNumber(value, 1));
  return Math.max(1, Math.floor(slidesPerView));
};

const getMobileSlidesPerView = (carousel) => {
  const columns = getSlidesPerView(carousel.dataset.swiperColumnsMobile);

  // The preview is intended for a one-column mobile layout. Keep an explicit
  // two-column choice intact instead of silently replacing it with 1.2.
  if (columns === 1 && carousel.dataset.swiperNextSlidePreviewMobile === 'true') {
    return 1.2;
  }

  return columns;
};

const getPaginationType = (value) => (value === 'progress_bar' ? 'progressbar' : 'bullets');

const getControls = (carousel, scope) => {
  const previousSelector = carousel.dataset.swiperPreviousSelector;
  const nextSelector = carousel.dataset.swiperNextSelector;
  if (!previousSelector && !nextSelector) return null;

  return {
    scope,
    previous: previousSelector,
    next: nextSelector,
  };
};

const getFirstDataValue = (elements, key) => {
  for (const element of elements) {
    const value = element?.dataset?.[key];
    if (value !== undefined && value !== '') return value;
  }

  return null;
};

const buildOptions = (carousel, scope) => {
  const pagination =
    carousel.querySelector('[data-product-collection-pagination]') ||
    carousel.querySelector('[data-swiper-pagination]');
  const paginationType = getPaginationType(pagination?.dataset.paginationType || carousel.dataset.swiperPaginationType);
  const options = {
    slidesPerView: getMobileSlidesPerView(carousel),
    spaceBetween: toNumber(carousel.dataset.swiperGapMobile, 0),
    breakpoints: {
      [desktopBreakpoint]: {
        slidesPerView: getSlidesPerView(carousel.dataset.swiperColumnsDesktop),
        spaceBetween: toNumber(carousel.dataset.swiperGapDesktop, 0),
      },
    },
    controls: getControls(carousel, scope),
  };

  if (pagination) {
    options.modules = [Pagination];
    options.pagination = {
      el: pagination,
      type: paginationType,
      clickable: paginationType === 'bullets',
    };
  }

  return options;
};

const getAutoplaySettings = (carousel, scope) => {
  const section = scope.closest('[data-collection-tabs]');
  const settingsSources = [carousel, scope, section];
  const autoplay = getFirstDataValue(settingsSources, 'swiperAutoplay');
  const pauseOnHover = getFirstDataValue(settingsSources, 'swiperAutoplayPauseOnHover');
  const delay = getFirstDataValue(settingsSources, 'swiperAutoplayDelay');
  const legacyAutoplay =
    scope.matches('[data-collection-tab-carousel]') &&
    scope.dataset.autoplay === 'true' &&
    section?.dataset.autoplay === 'true';

  return {
    enabled: (autoplay === null ? legacyAutoplay : autoplay === 'true') && !prefersReducedMotion(),
    pauseOnHover: pauseOnHover !== 'false',
    delay: Math.min(60000, Math.max(1000, toNumber(delay, 4000))),
  };
};

const isVisible = (element) => element.getClientRects().length > 0;

const isWrapperHovered = (swiper) => swiper.wrapperEl?.matches(':hover') || false;

const startAutoplay = (state) => {
  const autoplay = getAutoplaySettings(state.carousel, state.scope);
  if (!autoplay.enabled) return;

  state.interval = window.setInterval(() => {
    if (
      document.hidden ||
      !isVisible(state.carousel) ||
      (autoplay.pauseOnHover && isWrapperHovered(state.swiper)) ||
      state.scope.contains(document.activeElement) ||
      state.swiper.isLocked
    ) {
      return;
    }

    if (state.swiper.isEnd) {
      state.swiper.slideTo(0);
    } else {
      state.swiper.slideNext();
    }
  }, autoplay.delay);
};

const observeVisibility = (state) => {
  const panel = state.carousel.closest('[data-collection-tab-panel]');
  if (!panel || typeof MutationObserver === 'undefined') return;

  state.visibilityObserver = new MutationObserver(() => {
    if (!panel.hidden) window.requestAnimationFrame(() => state.swiper.update());
  });
  state.visibilityObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
};

const observeSize = (state) => {
  if (typeof ResizeObserver === 'undefined') return;

  state.resizeObserver = new ResizeObserver(() => {
    if (state.swiper && isVisible(state.carousel)) state.swiper.update();
  });
  state.resizeObserver.observe(state.carousel);
};

const initialize = (carousel) => {
  if (!carousel || instances.has(carousel)) return;

  const scope = getCarouselScope(carousel);
  const state = {
    carousel,
    scope,
    swiper: null,
    interval: null,
    resizeObserver: null,
    visibilityObserver: null,
    mobileQuery: null,
    mobileQueryHandler: null,
  };
  instances.set(carousel, state);

  if (carousel.dataset.swiperMobileOnly === 'true') {
    state.mobileQuery = window.matchMedia(`(max-width: ${desktopBreakpoint - 0.02}px)`);
    state.mobileQueryHandler = () => {
      if (state.mobileQuery.matches) {
        if (!state.swiper) {
          state.swiper = createSwiperCarousel(carousel, buildOptions(carousel, scope));
        }
      } else if (state.swiper) {
        destroySwiperCarousel(state.swiper);
        state.swiper = null;
      }
    };
    state.mobileQuery.addEventListener('change', state.mobileQueryHandler);
    observeSize(state);
    state.mobileQueryHandler();
    return;
  }

  const swiper = createSwiperCarousel(carousel, buildOptions(carousel, scope));
  if (!swiper) {
    instances.delete(carousel);
    return;
  }
  state.swiper = swiper;
  startAutoplay(state);
  observeSize(state);
  observeVisibility(state);
};

const initializeRoot = (root = document) => {
  if (root.matches?.(carouselSelector)) initialize(root);
  root.querySelectorAll?.(carouselSelector).forEach(initialize);
};

export { initializeRoot as initializeThemeModule };

const destroy = (carousel) => {
  const state = instances.get(carousel);
  if (!state) return;

  if (state.interval) window.clearInterval(state.interval);
  state.resizeObserver?.disconnect();
  state.visibilityObserver?.disconnect();
  state.mobileQuery?.removeEventListener('change', state.mobileQueryHandler);
  if (state.swiper) destroySwiperCarousel(state.swiper);
  instances.delete(carousel);
};

const destroyRoot = (root) => {
  const carousels = [];
  if (root.matches?.(carouselSelector)) carousels.push(root);
  root.querySelectorAll?.(carouselSelector).forEach((carousel) => carousels.push(carousel));
  carousels.forEach(destroy);
};

document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:select', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyRoot(event.target));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
} else {
  initializeRoot();
}
