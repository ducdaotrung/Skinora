const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  let Gallery;
  const source = fs.readFileSync(path.join(__dirname, '../assets/product-media.js'), 'utf8')
    .replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, {
    HTMLElement: class {},
    customElements: { get() { return null; }, define(name, value) { Gallery = value; } },
    window: { requestAnimationFrame(callback) { callback(); } },
    performance: { now() { return 100; } },
  });
  const gallery = Object.create(Gallery.prototype);
  gallery.mobileQuery = { matches: false };
  gallery.dataset = { overlayPresentation: 'quick-add-strip' };
  gallery._lightboxZoomState = { mediaSuppressClickUntil: 0 };
  let next = 0;
  gallery.mainSwiper = {
    allowTouchMove: true, el: { clientWidth: 520 },
    slideNext() { next++; }, slidePrev() { next--; },
  };
  const media = {
    classList: { contains() { return true; } },
    closest(selector) { return selector === '[data-product-media-content]' ? this : null; },
  };
  const captures = [];
  const rail = {
    setPointerCapture(id) { captures.push(id); }, releasePointerCapture() {},
  };
  const event = (x = 200, y = 100) => ({
    isPrimary: true, pointerType: 'mouse', button: 0, pointerId: 7,
    clientX: x, clientY: y, currentTarget: rail, target: media,
    preventDefault() { this.prevented = true; }, stopPropagation() {},
  });
  return { gallery, event, captures, get next() { return next; } };
}

test('a stationary click retains its image target and opens media', () => {
  const f = fixture();
  f.gallery.handleQuickAddStripPointerDown(f.event());
  assert.equal(f.captures.length, 0);
  f.gallery.handleQuickAddStripPointerUp(f.event());
  let activated = false;
  f.gallery.activateMedia = () => { activated = true; };
  f.gallery.handleClick(f.event());
  assert.equal(activated, true);
  assert.equal(f.gallery.mainSwiper.allowTouchMove, true);
});

test('minor pointer movement still behaves as a click', () => {
  const f = fixture();
  f.gallery.handleQuickAddStripPointerDown(f.event());
  f.gallery.handleQuickAddStripPointerMove(f.event(203, 102));
  assert.equal(f.captures.length, 0);
  f.gallery.handleQuickAddStripPointerUp(f.event(203, 102));
  assert.equal(f.next, 0);
  assert.equal(f.gallery.lightboxZoomState.mediaSuppressClickUntil, 0);
});

test('horizontal drag captures after the threshold, slides and suppresses its click', () => {
  const f = fixture();
  f.gallery.handleQuickAddStripPointerDown(f.event());
  f.gallery.handleQuickAddStripPointerMove(f.event(190));
  assert.deepEqual(f.captures, [7]);
  f.gallery.handleQuickAddStripPointerUp(f.event(100));
  assert.equal(f.next, 1);
  assert.equal(f.gallery.mainSwiper.allowTouchMove, true);
  f.gallery.activateMedia = () => assert.fail('drag must not open lightbox');
  const click = f.event(100);
  f.gallery.handleClick(click);
  assert.equal(click.prevented, true);
});

test('vertical scrolling never captures or advances the strip', () => {
  const f = fixture();
  f.gallery.handleQuickAddStripPointerDown(f.event());
  f.gallery.handleQuickAddStripPointerMove(f.event(201, 120));
  assert.equal(f.captures.length, 0);
  assert.equal(f.next, 0);
  assert.equal(f.gallery.mainSwiper.allowTouchMove, true);
});
