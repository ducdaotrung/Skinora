import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

const instances = new WeakMap();
const mobileQuery = window.matchMedia('(max-width: 767.98px)');

const mobileGap = (root) => Number.parseFloat(
  getComputedStyle(root).getPropertyValue('--collections-background-gap-mobile'),
) || 8;

const activate = (state, id, focus = false) => {
  const entry = state.entries.find((candidate) => candidate.id === id) || state.entries[0];
  if (!entry) return;
  state.entries.forEach((candidate) => {
    const active = candidate === entry;
    candidate.trigger.setAttribute('aria-selected', String(active));
    candidate.trigger.tabIndex = active ? 0 : -1;
    candidate.panel.setAttribute('aria-hidden', String(!active));
    candidate.item.classList.toggle('is-active', active);
  });
  if (focus) entry.trigger.focus();
};

const initialize = (root) => {
  if (!root || instances.has(root)) return;
  const tablist = root.querySelector('[data-collections-background-tabs]');
  const carousel = root.querySelector('[data-collections-background-swiper]');
  if (!tablist) return;
  const entries = [...root.querySelectorAll('[data-collections-background-item]')]
    .map((item) => ({
      id: item.dataset.itemId,
      trigger: item.querySelector('[data-collections-background-trigger]'),
      panel: item.querySelector('[data-collections-background-panel]'),
      item,
    }))
    .filter((entry) => entry.trigger && entry.panel);
  if (!entries.length) return;

  const controller = new AbortController();
  entries.forEach((entry) => tablist.append(entry.trigger));
  const state = { carousel, controller, entries, mobileSwiper: null };
  instances.set(root, state);
  const updatePresentation = () => {
    const useMobileSwiper = mobileQuery.matches && root.dataset.mobileLayout === 'horizontal';
    if (useMobileSwiper && carousel && !state.mobileSwiper) {
      state.mobileSwiper = createSwiperCarousel(carousel, {
        slidesPerView: 1.2,
        spaceBetween: mobileGap(root),
      });
    }
    if (!useMobileSwiper && state.mobileSwiper) {
      destroySwiperCarousel(state.mobileSwiper);
      state.mobileSwiper = null;
    }
    if (mobileQuery.matches) {
      tablist.hidden = true;
      tablist.setAttribute('aria-hidden', 'true');
      entries.forEach((entry) => {
        entry.trigger.tabIndex = -1;
        entry.trigger.setAttribute('aria-selected', 'false');
        entry.panel.removeAttribute('aria-hidden');
      });
      return;
    }
    tablist.hidden = false;
    tablist.removeAttribute('aria-hidden');
    activate(state, entries.find((entry) => entry.trigger.getAttribute('aria-selected') === 'true')?.id || entries[0].id);
  };
  updatePresentation();

  const updateStickyTitle = () => {
    if (root.dataset.stickyTitle !== 'true' || mobileQuery.matches) {
      root.classList.remove('is-sticky-title');
      return;
    }
    const bounds = root.getBoundingClientRect();
    root.classList.toggle('is-sticky-title', bounds.top <= 0 && bounds.bottom > window.innerHeight);
  };
  updateStickyTitle();

  tablist.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-collections-background-trigger]');
    const entry = entries.find((candidate) => candidate.trigger === trigger);
    if (entry) activate(state, entry.id);
  }, { signal: controller.signal });

  tablist.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const trigger = event.target.closest('[data-collections-background-trigger]');
    const entry = entries.find((candidate) => candidate.trigger === trigger);
    if (entry) activate(state, entry.id);
  }, { signal: controller.signal });

  tablist.addEventListener('focusin', (event) => {
    const entry = entries.find((candidate) => candidate.trigger === event.target);
    if (entry) activate(state, entry.id);
  }, { signal: controller.signal });

  tablist.addEventListener('keydown', (event) => {
    const current = entries.findIndex((entry) => entry.trigger === event.target);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = current;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + entries.length) % entries.length;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % entries.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = entries.length - 1;
    activate(state, entries[next].id, true);
  }, { signal: controller.signal });
  mobileQuery.addEventListener('change', updatePresentation, { signal: controller.signal });
  mobileQuery.addEventListener('change', updateStickyTitle, { signal: controller.signal });
  window.addEventListener('scroll', updateStickyTitle, { passive: true, signal: controller.signal });
  window.addEventListener('resize', updateStickyTitle, { passive: true, signal: controller.signal });
};

const initializeRoot = (root = document) => {
  if (root.matches?.('[data-collections-background]')) initialize(root);
  root.querySelectorAll?.('[data-collections-background]').forEach(initialize);
};

const destroyRoot = (root) => {
  const roots = [];
  if (root.matches?.('[data-collections-background]')) roots.push(root);
  root.querySelectorAll?.('[data-collections-background]').forEach((node) => roots.push(node));
  roots.forEach((node) => {
    const state = instances.get(node);
    if (!state) return;
    state.controller.abort();
    if (state.mobileSwiper) destroySwiperCarousel(state.mobileSwiper);
    node.classList.remove('is-sticky-title');
    state.entries.forEach((entry) => {
      entry.panel.removeAttribute('aria-hidden');
      entry.trigger.setAttribute('aria-selected', 'false');
      entry.trigger.tabIndex = -1;
    });
    instances.delete(node);
  });
};

document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyRoot(event.target));
document.addEventListener('shopify:block:select', (event) => {
  const root = event.target.closest?.('[data-collections-background]');
  initialize(root);
  const state = instances.get(root);
  const id = event.target.closest?.('[data-collections-background-item]')?.dataset.itemId;
  if (state && id) {
    activate(state, id);
    const index = state.entries.findIndex((entry) => entry.id === id);
    if (state.mobileSwiper && index >= 0) state.mobileSwiper.slideTo(index);
  }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
else initializeRoot();
