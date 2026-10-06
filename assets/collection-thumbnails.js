import { Pagination } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

const selector = '[data-collection-thumbnails-carousel][data-layout="carousel"]';
const states = new WeakMap();

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const overflow = (carousel) => {
  const wrapper = carousel.querySelector('.swiper-wrapper');
  if (!wrapper) return false;

  const gap = number(
    window.innerWidth >= 1150
      ? carousel.dataset.swiperGapDesktop
      : carousel.dataset.swiperGapMobile,
    0,
  );
  const itemWidth = [...wrapper.children].reduce((total, item) => total + item.offsetWidth, 0);
  return itemWidth + Math.max(0, wrapper.children.length - 1) * gap > carousel.clientWidth + 1;
};

const getPaginationType = (value) => (value === 'progress_bar' ? 'progressbar' : 'bullets');

const getPagination = (carousel) =>
  carousel.querySelector('[data-product-collection-pagination], [data-swiper-pagination]');

const buildOptions = (carousel, scope) => {
  const pagination = getPagination(carousel);
  const options = {
    slidesPerView: 'auto',
    spaceBetween: number(carousel.dataset.swiperGapMobile, 20),
    breakpoints: {
      1150: {
        slidesPerView: 'auto',
        spaceBetween: number(carousel.dataset.swiperGapDesktop, 40),
      },
    },
    controls: {
      scope,
      previous: carousel.dataset.swiperPreviousSelector,
      next: carousel.dataset.swiperNextSelector,
    },
  };

  if (pagination) {
    const paginationType = getPaginationType(
      pagination.dataset.paginationType || carousel.dataset.swiperPaginationType,
    );
    options.modules = [Pagination];
    options.pagination = {
      el: pagination,
      type: paginationType,
      clickable: paginationType === 'bullets',
    };
  }

  return options;
};

const sync = (carousel) => {
  const state = states.get(carousel);
  if (!state) return;

  const active = overflow(carousel);
  carousel.classList.toggle('is-static', !active);

  if (!active && state.swiper) {
    destroySwiperCarousel(state.swiper);
    state.swiper = null;
  }

  if (active && !state.swiper) {
    state.swiper = createSwiperCarousel(carousel, buildOptions(carousel, state.scope));
  }
};

const initialize = (carousel) => {
  if (states.has(carousel)) return;

  const state = {
    swiper: null,
    scope: carousel.closest('[data-collection-thumbnails]') || carousel.parentElement,
  };
  states.set(carousel, state);
  state.observer = new ResizeObserver(() => sync(carousel));
  state.observer.observe(carousel);
  sync(carousel);
};

const initializeRoot = (root = document) => {
  if (root.matches?.(selector)) initialize(root);
  root.querySelectorAll?.(selector).forEach(initialize);
};

const destroy = (root) => {
  const carousels = root.matches?.(selector)
    ? [root]
    : [...(root.querySelectorAll?.(selector) || [])];

  carousels.forEach((carousel) => {
    const state = states.get(carousel);
    if (!state) return;
    state.observer.disconnect();
    if (state.swiper) destroySwiperCarousel(state.swiper);
    states.delete(carousel);
  });
};

document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:select', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:unload', (event) => destroy(event.target));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
} else {
  initializeRoot();
}
