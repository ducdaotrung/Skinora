const instances = new WeakMap();
const listSelector = '[data-product-list], [data-collection-tab-panel]';

const initialize = (list) => {
  if (instances.has(list)) return;
  const host = list.querySelector('[data-product-list-mobile-promos]');
  const cards = [...list.querySelectorAll('[data-product-list-promo-item]')]
    .filter((item) => item.closest(listSelector) === list);
  if (!host || !cards.length) return;

  const entries = cards.map((item) => {
    const anchor = document.createComment('promo-card-position');
    item.before(anchor);
    return { item, anchor, slide: item.classList.contains('swiper-slide') };
  });
  const query = window.matchMedia('(max-width: 767.98px)');
  const update = () => {
    const carousel = list.querySelector('[data-product-carousel]');
    const swiper = carousel?.swiper;
    const activeItem = swiper?.slides?.[swiper.activeIndex];
    entries.forEach(({ item, anchor, slide }) => {
      const onTop = query.matches && item.querySelector('[data-promo-mobile-top="true"]');
      if (onTop) {
        item.classList.remove('swiper-slide');
        item.style.width = '';
        item.style.marginRight = '';
        host.append(item);
      } else {
        item.classList.toggle('swiper-slide', slide);
        anchor.after(item);
      }
    });
    if (swiper && !swiper.destroyed) {
      swiper.update();
      const index = [...swiper.slides].indexOf(activeItem);
      swiper.slideTo(Math.max(0, index), 0);
    }
  };
  const select = (event) => {
    const item = event.target.closest?.('[data-product-list-promo-item]');
    if (!item || !list.contains(item)) return;
    const carousel = list.querySelector('[data-product-carousel]');
    const swiper = carousel?.swiper;
    if (host.contains(item)) item.scrollIntoView({ block: 'nearest' });
    else if (swiper && !swiper.destroyed) {
      const index = [...swiper.slides].indexOf(item);
      if (index < 0) return;
      // Selecting a visible card must not make its configured slot look like slot 1.
      const bounds = carousel.getBoundingClientRect();
      const cardBounds = item.getBoundingClientRect();
      if (cardBounds.left >= bounds.left - 1 && cardBounds.right <= bounds.right + 1) return;
      const visibleCount = Math.max(1, Math.floor(Number(swiper.params.slidesPerView) || 1));
      const target = index < swiper.activeIndex ? index : Math.max(0, index - visibleCount + 1);
      swiper.slideTo(target, 0);
    }
  };
  query.addEventListener('change', update);
  list.addEventListener('shopify:block:select', select);
  instances.set(list, { entries, query, update, select });
  update();
};

export const initializeThemeModule = (root = document) => {
  if (root.matches?.(listSelector)) initialize(root);
  root.querySelectorAll?.(listSelector).forEach(initialize);
};

const destroy = (list) => {
  const state = instances.get(list);
  if (!state) return;
  state.query.removeEventListener('change', state.update);
  list.removeEventListener('shopify:block:select', state.select);
  state.entries.forEach(({ item, anchor, slide }) => {
    item.classList.toggle('swiper-slide', slide);
    anchor.after(item);
    anchor.remove();
  });
  instances.delete(list);
};

document.addEventListener('shopify:section:load', (event) => initializeThemeModule(event.target));
document.addEventListener('shopify:section:unload', (event) => {
  if (event.target.matches?.(listSelector)) destroy(event.target);
  event.target.querySelectorAll?.(listSelector).forEach(destroy);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeThemeModule(), { once: true });
} else initializeThemeModule();
