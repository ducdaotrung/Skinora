const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture({ featured = true, filtered = false, activeIndex = 1 } = {}) {
  let Gallery;
  vm.runInNewContext(fs.readFileSync('assets/product-media.js', 'utf8').replace(/^import .*;\n/gm, ''), {
    HTMLElement: class {},
    customElements: { get() {}, define(name, value) { Gallery = value; } },
    window: { requestAnimationFrame(callback) { callback(); } },
  });
  const gallery = Object.create(Gallery.prototype);
  const slides = ['10', '20', '30'].map((mediaId) => ({
    dataset: { mediaId, variantIds: mediaId === '10' ? '1,2' : '' },
    hidden: false, style: {}, setAttribute() {},
  }));
  const transitions = [];
  gallery.dataset = { currentVariantMediaId: '10', filterVariantMedia: String(filtered) };
  gallery.productInformation = { hasAttribute() { return featured; } };
  gallery.querySelectorAll = () => slides;
  gallery.syncThumbnailVisibility = () => {};
  gallery.syncGalleryOverflow = () => {};
  Object.defineProperty(gallery, 'galleryMode', { value: 'desktop-slider' });
  gallery.mainSwiper = {
    slides, activeIndex,
    update() {}, slideTo(index) { transitions.push(index); this.activeIndex = index; },
  };
  gallery.thumbnailSwiper = { update() {} };
  gallery.destroyGallery = () => assert.fail('unchanged visibility must not rebuild the carousel');
  const change = (id, mediaId) => gallery.handleVariantChange({
    detail: { variantId: id, variant: { id, featured_media: mediaId ? { id: mediaId } : null } },
  });
  return { gallery, change, transitions };
}

test('Featured product keeps manually selected media when another variant shares its image', () => {
  for (const filtered of [false, true]) {
    const f = fixture({ filtered });
    f.change('2', '10');
    assert.deepEqual(f.transitions, []);
    assert.equal(f.gallery.dataset.currentVariantId, '2');
    assert.equal(f.gallery.dataset.currentVariantMediaId, '10');
    assert.equal(f.gallery.mainSwiper.activeIndex, 1);
  }
});

test('Featured product moves only when the variant image changes', () => {
  const f = fixture();
  f.change('3', '30');
  assert.deepEqual(f.transitions, [2]);
  f.gallery.mainSwiper.activeIndex = 1;
  f.change('4', '30');
  assert.deepEqual(f.transitions, [2]);
  f.change('5');
  assert.deepEqual(f.transitions, [2]);
});

test('an already active image does not trigger slideTo', () => {
  const f = fixture({ activeIndex: 2 });
  f.change('3', '30');
  f.gallery.showMedia('30');
  assert.deepEqual(f.transitions, []);
});

test('other product galleries retain variant image navigation', () => {
  const f = fixture({ featured: false });
  f.change('2', '10');
  assert.deepEqual(f.transitions, [0]);
});

test('a changed media filter rebuilds the gallery with a visible target', () => {
  const f = fixture({ filtered: true, activeIndex: 0 });
  const rebuilt = [];
  f.gallery.destroyGallery = () => { rebuilt.push('destroy'); };
  f.gallery.initializeGallery = (mediaId) => { rebuilt.push(mediaId); };
  const slides = f.gallery.mainSwiper.slides;
  slides[1].dataset.variantIds = '3';
  f.change('3', '20');
  assert.equal(slides[0].hidden, true);
  assert.equal(slides[1].hidden, false);
  assert.deepEqual(rebuilt, ['destroy', '20']);
});
