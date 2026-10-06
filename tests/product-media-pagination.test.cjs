const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(type = 'bullets') {
  let Gallery;
  const options = [];
  const classes = new Set();
  const pagination = {
    dataset: { paginationType: type }, hidden: true,
    replaceChildren() { this.empty = true; },
    classList: { remove(...names) { names.forEach((name) => classes.delete(name)); } },
    toggleAttribute(name, value) { this[name] = value; },
  };
  const slides = [{ hidden: false }, { hidden: false }, { hidden: false }];
  const main = {};
  vm.runInNewContext(fs.readFileSync('assets/product-media.js', 'utf8').replace(/^import .*;\n/gm, ''), {
    HTMLElement: class {}, Pagination: 'Pagination', Thumbs: 'Thumbs',
    customElements: { get() {}, define(name, value) { Gallery = value; } },
    window: { matchMedia() { return { matches: false }; } },
    getComputedStyle() { return { getPropertyValue() { return ''; } }; },
    createSwiperCarousel(element, config) {
      options.push(config);
      classes.add(config.pagination?.type === 'progressbar' ? 'swiper-pagination-progressbar' : 'swiper-pagination-bullets');
      return { update() {}, destroy() {} };
    },
    destroySwiperCarousel(swiper) { swiper?.destroy(); },
  });
  const gallery = Object.create(Gallery.prototype);
  gallery.dataset = { mobileLayout: 'slider', mobileShowPagination: 'true' };
  gallery.mobileQuery = { matches: true };
  Object.defineProperties(gallery, {
    mainElement: { value: main }, thumbnailElement: { value: null },
    galleryMode: { get() { return this.mobileQuery.matches ? 'mobile' : 'desktop-static'; } },
  });
  gallery.querySelector = (selector) => selector === '[data-product-media-pagination]' ? pagination : null;
  gallery.querySelectorAll = () => slides;
  gallery.syncQuickAddStripSlidesPerView = () => {};
  return { gallery, pagination, slides, options, classes };
}

test('mobile progress uses Swiper progressbar and survives desktop/mobile rebuild', () => {
  const f = fixture('progress_bar');
  f.gallery.initializeGallery();
  assert.equal(f.options[0].pagination.type, 'progressbar');
  assert.equal(f.options[0].pagination.clickable, false);
  assert.equal(f.pagination.hidden, false);
  f.gallery.mobileQuery.matches = false;
  f.gallery.initializeGallery();
  assert.equal(f.pagination.hidden, true);
  assert.equal(f.classes.has('swiper-pagination-progressbar'), false);
  f.gallery.mobileQuery.matches = true;
  f.gallery.initializeGallery();
  assert.equal(f.options[1].pagination.type, 'progressbar');
  assert.equal(f.pagination.hidden, false);
  f.slides.slice(1).forEach((slide) => { slide.hidden = true; });
  f.gallery.syncPaginationVisibility(true);
  assert.equal(f.pagination.hidden, true);
});

test('bullets remain clickable and unknown types fall back to bullets', () => {
  for (const type of ['bullets', undefined, 'invalid']) {
    const f = fixture(type);
    f.gallery.initializeGallery();
    assert.equal(f.options[0].pagination.type, 'bullets');
    assert.equal(f.options[0].pagination.clickable, true);
  }
});

test('disabled pagination and mobile thumbnail layouts do not initialize pagination', () => {
  for (const settings of [{ mobileShowPagination: 'false' }, { mobileLayout: 'thumbnails' }]) {
    const f = fixture('progress_bar');
    Object.assign(f.gallery.dataset, settings);
    f.gallery.initializeGallery();
    assert.equal(f.options[0].pagination, undefined);
    assert.equal(f.pagination.hidden, true);
  }
});
