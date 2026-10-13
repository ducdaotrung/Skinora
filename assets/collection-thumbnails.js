import { Pagination } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

const selector = '[data-collection-thumbnails-carousel][data-layout="carousel"]';
const customBlockSelector = '[data-collection-thumbnails-block]';
const states = new WeakMap();

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const visibleSlidesAt = (carousel, desktop) => {
  const columns = number(
    desktop ? carousel.dataset.swiperColumnsDesktop : carousel.dataset.swiperColumnsMobile,
    desktop ? 4 : 1,
  );
  const showPreview = carousel.dataset[
    desktop ? 'swiperNextSlidePreview' : 'swiperNextSlidePreviewMobile'
  ] === 'true';
  return columns + (showPreview ? 0.25 : 0);
};

const visibleSlides = (carousel) => visibleSlidesAt(carousel, window.innerWidth >= 768);

const overflow = (carousel) => {
  const wrapper = carousel.querySelector('.swiper-wrapper');
  if (!wrapper) return false;
  return wrapper.children.length > visibleSlides(carousel);
};

const getPaginationType = (value) => (value === 'progress_bar' ? 'progressbar' : 'bullets');

const getPagination = (carousel) =>
  carousel.querySelector('[data-product-collection-pagination], [data-swiper-pagination]');

const buildOptions = (carousel, scope) => {
  const pagination = getPagination(carousel);
  const mobileColumns = visibleSlidesAt(carousel, false);
  const desktopColumns = visibleSlidesAt(carousel, true);
  const mobileGap = number(carousel.dataset.swiperGapMobile, 20);
  const desktopGap = number(carousel.dataset.swiperGapDesktop, 40);
  const options = {
    slidesPerView: mobileColumns,
    spaceBetween: mobileGap,
    breakpoints: {
      768: {
        slidesPerView: desktopColumns,
        spaceBetween: mobileGap,
      },
      1150: {
        slidesPerView: desktopColumns,
        spaceBetween: desktopGap,
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

  const wrapper = carousel.querySelector('.swiper-wrapper');
  wrapper?.querySelectorAll(':scope > *').forEach((slide) => slide.classList.add('swiper-slide'));

  const state = {
    swiper: null,
    scope: carousel.closest('[data-collection-thumbnails]') || carousel.parentElement,
  };
  states.set(carousel, state);
  state.observer = new ResizeObserver(() => sync(carousel));
  state.observer.observe(carousel);
  sync(carousel);
};

const updateCustomBlockHeadingTags = (root = document) => {
  const blocks = root.matches?.(customBlockSelector)
    ? [root]
    : [...(root.querySelectorAll?.(customBlockSelector) || [])];

  blocks.forEach((block) => {
    const tagName = block.dataset.titleTag;
    if (!/^(div|h[1-6])$/.test(tagName || '')) return;

    block.querySelectorAll('.collection-thumbnail__title').forEach((heading) => {
      if (heading.tagName.toLowerCase() === tagName) return;

      const replacement = document.createElement(tagName);
      [...heading.attributes].forEach((attribute) =>
        replacement.setAttribute(attribute.name, attribute.value),
      );
      while (heading.firstChild) replacement.append(heading.firstChild);
      heading.replaceWith(replacement);
    });
  });
};

const initializeRoot = (root = document) => {
  updateCustomBlockHeadingTags(root);
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
document.addEventListener('shopify:block:select', (event) => {
  const block = event.target.closest?.(customBlockSelector);
  if (block) updateCustomBlockHeadingTags(block);
});
document.addEventListener('shopify:section:unload', (event) => destroy(event.target));

export { initializeRoot as initializeThemeModule };
