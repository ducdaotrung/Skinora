const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Controller contract tests, not a substitute for native-dialog browser QA.
function fixture({ mobile = true, reduced = false, portal = false } = {}) {
  const timers = new Map();
  const frames = new Map();
  const nativeEvents = [];
  const timerDelays = [];
  let id = 0;
  let now = 0;
  const rootClasses = new Set();
  const document = {
    activeElement: null,
    documentElement: {
      classList: {
        contains: (name) => rootClasses.has(name),
        toggle: (name, force) => {
          if (force === undefined) force = !rootClasses.has(name);
          if (force) rootClasses.add(name);
          else rootClasses.delete(name);
          return force;
        },
      },
    },
  };
  class Element extends EventTarget {
    constructor() {
      super();
      this.dataset = {};
      this.attributes = {};
      this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle: (name, force) => {
          if (force === undefined) force = !classes.has(name);
          if (force) classes.add(name);
          else classes.delete(name);
          return force;
        },
        [Symbol.iterator]: () => classes[Symbol.iterator](),
      };
      this.offsetHeight = 500;
      this.scrollTop = 0;
      this.isConnected = true;
      this.tabIndex = 0;
    }
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() { this.focusCount = (this.focusCount || 0) + 1; document.activeElement = this; }
    blur() { this.blurCount = (this.blurCount || 0) + 1; if (document.activeElement === this) document.activeElement = null; }
    getClientRects() { return [{}]; }
    closest() { return null; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
  }
  const header = new Element();
  const closeButton = new Element();
  const backdrop = new Element();
  const panel = new Element();
  const body = new Element();
  const backdropCursor = new Element();
  const opener = new Element();
  const lastInput = new Element();
  document.activeElement = opener;
  const dialog = new Element();
  const originalParent = {
    insertBefore(element) {
      element.parentNode = this;
      element.parentElement = this;
    },
  };
  document.querySelector = (selector) => selector === 'custom-cursor[data-component-overlay-cursor]' ? backdropCursor : null;
  document.body = {
    append(element) {
      element.parentNode = this;
      element.parentElement = this;
    },
  };
  panel.querySelector = (selector) => selector === '.component-overlay__body' ? body : null;
  Object.assign(dialog, {
    open: false,
    dataset: { mobileLayout: 'bottom_sheet', state: 'closed' },
    querySelector: (selector) => {
      if (selector === '.component-overlay__header') return header;
      if (selector === '.component-overlay__panel') return panel;
      if (selector === '[data-component-overlay-backdrop]') return backdrop;
      return closeButton;
    },
    querySelectorAll: () => [closeButton, lastInput],
    showModal() { this.open = true; document.activeElement = closeButton; },
    close() { this.open = false; nativeEvents.push(() => this.dispatchEvent(new Event('close'))); },
    remove() { this.parentNode = null; this.parentElement = null; },
    getBoundingClientRect: () => ({ left: 0, top: 100, right: 400, bottom: 600 }),
    parentNode: originalParent,
    parentElement: originalParent,
    nextSibling: null,
  });
  if (portal) dialog.attributes['data-append-to-body'] = '';
  const media = new EventTarget();
  media.matches = mobile;
  const reducedMedia = new EventTarget();
  reducedMedia.matches = reduced;
  const window = { matchMedia: (query) => query.includes('reduced') ? reducedMedia : media };
  const context = {
    window, document, AbortController, Event,
    performance: { now: () => now },
    getComputedStyle: (element) => element === backdrop
      ? { transitionDuration: '0s', transitionDelay: '0s', animationDuration: '0.7s', animationDelay: '0s' }
      : { transitionDuration: reduced ? '0s' : '0.5s', transitionDelay: '0s', animationDuration: '0s', animationDelay: '0s' },
    setTimeout: (fn, delay = 0) => { timerDelays.push(delay); timers.set(++id, fn); return id; },
    clearTimeout: (key) => timers.delete(key),
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/component-overlay.js'), 'utf8'), context);
  const flush = (queue) => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach((fn) => fn()); };
  return {
    context, api: window.ThemeOverlay, dialog, header, panel, body, opener, closeButton, backdrop, backdropCursor, lastInput, document, media, timers, frames, timerDelays,
    overlay: window.ThemeOverlay.get(dialog),
    tick: (ms) => { now += ms; },
    flushTimers: () => flush(timers), flushFrames: () => flush(frames),
    flushNative: () => nativeEvents.splice(0).forEach((fn) => fn()),
    pointer: (y, target = header) => ({ target, pointerId: 1, clientY: y, isPrimary: true, button: 0, preventDefault() {} }),
  };
}

function collectionFixture(options) {
  const f = fixture(options);
  f.overlay.destroy();
  f.flushNative();
  const definitions = new Map();
  Object.assign(f.context, {
    HTMLElement: f.panel.constructor,
    customElements: { get: (name) => definitions.get(name), define: (name, type) => definitions.set(name, type) },
  });
  Object.assign(f.context.window, {
    addEventListener() {}, removeEventListener() {},
    setTimeout: f.context.setTimeout, clearTimeout: f.context.clearTimeout,
  });
  f.document.addEventListener = () => {};
  f.document.removeEventListener = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/section-collection.js'), 'utf8'), f.context);
  f.facets = new (definitions.get('collection-facets'))();
  // Isolate dialog wiring from unrelated grid, pagination and sticky layout work.
  for (const name of ['mountFilterPanel', 'syncLayout', 'initializeSidebarSticky', 'syncColumns', 'observePagination']) {
    f.facets[name] = () => {};
  }
  f.facets.querySelector = (selector) => selector === '[data-collection-filter-dialog]' ? f.dialog : null;
  f.dialog.querySelector = (selector) => ({
    '.main-collection__filter-form': f.panel,
    '.main-collection__filter-header': f.header,
    '.main-collection__filter-body': f.body,
  })[selector] || null;
  f.dialog.dataset.mobileLayout = 'sheet';
  f.facets.connectedCallback();
  f.dialog.showModal();
  // Model the follow-up click target when capture and pointerdown targets differ.
  f.clickCapturedPanel = () => f.facets.onClick({ target: f.facets.sheetGesture.panel });
  return f;
}

test('collection upward, tiny, short, reversed and cancelled drags keep the sheet open after click', () => {
  for (const [distance, cancelled, reverse] of [[-120, false], [4, false], [20, false], [120, false, true], [180, true]]) {
    const f = collectionFixture();
    const gesture = f.facets.sheetGesture;
    gesture.start(f.pointer(200));
    assert.equal(f.panel.capture, 1);
    assert.equal(f.dialog.capture, undefined);
    f.tick(200);
    gesture.move(f.pointer(200 + distance));
    if (reverse) {
      f.tick(200);
      gesture.move(f.pointer(180));
    }
    gesture.end(f.pointer(reverse ? 180 : 200 + distance), cancelled);
    f.clickCapturedPanel();
    f.flushFrames();
    f.flushTimers();
    assert.equal(f.dialog.open, true);
    assert.equal(f.dialog.classList.contains('is-closing'), false);
    assert.equal(f.panel.style.transform, undefined);
    assert.equal(f.panel.capture, null);
    assert.equal(f.panel.style['--sheet-drag-progress'], undefined);
    assert.equal(f.dialog.style['--sheet-drag-progress'], undefined);
  }
});

test('collection uses shared distance and fresh downward velocity dismissal', () => {
  for (const [distance, elapsed, pause, dismiss] of [[99, 200, 0, false], [100, 200, 0, true], [31, 10, 0, false], [40, 50, 0, true], [40, 50, 101, false]]) {
    const f = collectionFixture();
    const gesture = f.facets.sheetGesture;
    gesture.start(f.pointer(0));
    f.tick(elapsed);
    gesture.move(f.pointer(distance));
    assert.equal(f.dialog.style['--sheet-drag-progress'], f.panel.style['--sheet-drag-progress'], 'native backdrop follows the panel drag');
    f.tick(pause);
    gesture.end(f.pointer(distance));
    f.clickCapturedPanel();
    assert.equal(f.dialog.classList.contains('is-gesture-closing'), dismiss);
    if (dismiss) assert.equal(f.timerDelays.at(-1), 516, 'close waits for the inner panel transition');
    f.flushFrames();
    f.flushTimers();
    assert.equal(f.dialog.open, !dismiss);
    assert.equal(f.panel.style.transform, undefined);
    assert.equal(f.dialog.style['--sheet-drag-progress'], undefined);
  }
});

test('collection backdrop clicks and native Escape cancellation still close', () => {
  for (const action of ['backdrop', 'escape']) {
    const f = collectionFixture();
    if (action === 'backdrop') f.facets.onClick({ target: f.dialog });
    else {
      const event = new Event('cancel', { cancelable: true });
      f.dialog.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
    }
    assert.equal(f.dialog.classList.contains('is-closing'), true);
    f.flushTimers();
    assert.equal(f.dialog.open, false);
  }
});

test('collection reduced-motion gesture closes immediately and clears panel styles', () => {
  const f = collectionFixture({ reduced: true });
  f.facets.sheetGesture.start(f.pointer(0));
  f.tick(200);
  f.facets.sheetGesture.move(f.pointer(120));
  f.facets.sheetGesture.end(f.pointer(120));
  assert.equal(f.dialog.open, false);
  assert.equal(f.panel.style.transform, undefined);
  assert.equal(f.frames.size, 0);
});

test('one controller per dialog; default open focuses close and restores focus on close', () => {
  const f = fixture();
  assert.equal(f.api.get(f.dialog), f.overlay);
  f.overlay.open({ opener: f.opener });
  assert.equal(f.dialog.dataset.state, 'open');
  assert.equal(f.opener.attributes['aria-expanded'], 'true');
  assert.equal(f.closeButton.focusCount, 1);
  assert.equal(f.closeButton.blurCount, undefined);
  f.overlay.close();
  assert.equal(f.dialog.open, true);
  assert.equal(f.dialog.dataset.state, 'closing');
  f.flushTimers();
  f.flushNative();
  assert.equal(f.dialog.open, false);
  assert.equal(f.opener.focusCount, 1);
  assert.equal(f.opener.attributes['aria-expanded'], 'false');
});

test('explicit focus opt-out keeps focus on the editor interaction', () => {
  const f = fixture();
  f.overlay.open({ opener: null, focus: false, restoreFocus: false });
  assert.equal(f.dialog.dataset.state, 'open');
  assert.equal(f.closeButton.focusCount, undefined);
  assert.equal(f.closeButton.blurCount, 1);
  assert.equal(f.document.activeElement, f.opener);
});

test('close waits for the slower panel or backdrop timeline', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.close();
  assert.equal(f.timerDelays.at(-1), 716);
});

test('pointer-triggered close clears native focus without restoring it to the opener', () => {
  const f = fixture();
  f.overlay.open({ opener: f.opener, restoreFocus: false });
  f.overlay.close({ restoreFocus: false });
  f.document.activeElement = f.opener;
  f.flushTimers();
  f.flushNative();
  assert.equal(f.opener.focusCount, undefined);
  assert.equal(f.opener.blurCount, 1);
  assert.equal(f.document.activeElement, null);
  assert.equal(f.opener.attributes['aria-expanded'], 'false');
});

test('pointer click on the close action does not restore opener focus', () => {
  const f = fixture();
  f.closeButton.closest = (selector) => selector === '[data-overlay-close]' ? f.closeButton : null;
  f.overlay.open({ opener: f.opener });
  const event = new Event('click');
  Object.defineProperty(event, 'target', { value: f.closeButton });
  Object.defineProperty(event, 'detail', { value: 1 });
  f.dialog.dispatchEvent(event);
  f.flushTimers();
  f.flushNative();
  assert.equal(f.opener.focusCount, undefined);
  assert.equal(f.opener.attributes['aria-expanded'], 'false');
});

test('keyboard click on the close action restores opener focus', () => {
  const f = fixture();
  f.closeButton.closest = (selector) => selector === '[data-overlay-close]' ? f.closeButton : null;
  f.overlay.open({ opener: f.opener });
  const event = new Event('click');
  Object.defineProperty(event, 'target', { value: f.closeButton });
  Object.defineProperty(event, 'detail', { value: 0 });
  f.dialog.dispatchEvent(event);
  f.flushTimers();
  f.flushNative();
  assert.equal(f.opener.focusCount, 1);
  assert.equal(f.opener.attributes['aria-expanded'], 'false');
});

test('deferred opening lets the backdrop lead the panel by one frame', () => {
  const f = fixture();
  f.overlay.open({ defer: true });
  assert.equal(f.dialog.open, true);
  assert.equal(f.dialog.dataset.state, 'opening');
  assert.equal(f.closeButton.focusCount, undefined);
  f.flushFrames();
  assert.equal(f.dialog.dataset.state, 'open');
  assert.equal(f.closeButton.focusCount, 1);
  assert.equal(f.closeButton.blurCount, undefined);
});

test('reopening cancels pending close and ignores old queued native close event', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.close();
  f.overlay.open();
  f.flushTimers();
  assert.equal(f.dialog.open, true);
  f.overlay.close({ immediate: true });
  f.overlay.open();
  f.flushNative();
  assert.equal(f.dialog.dataset.state, 'open');
  assert.equal(f.opener.attributes['aria-expanded'], 'true');
});

test('Escape uses the animated lifecycle', () => {
  const f = fixture();
  f.overlay.open();
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key: 'Escape' });
  f.dialog.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.dialog.dataset.state, 'closing');
});

test('Tab and Shift+Tab wrap inside the overlay', () => {
  const f = fixture();
  f.overlay.open();
  f.document.activeElement = f.closeButton;
  const back = new Event('keydown', { cancelable: true });
  Object.assign(back, { key: 'Tab', shiftKey: true });
  f.dialog.dispatchEvent(back);
  assert.equal(back.defaultPrevented, true);
  assert.equal(f.document.activeElement, f.lastInput);
  const forward = new Event('keydown', { cancelable: true });
  Object.assign(forward, { key: 'Tab', shiftKey: false });
  f.dialog.dispatchEvent(forward);
  assert.equal(forward.defaultPrevented, true);
  assert.equal(f.document.activeElement, f.closeButton);
});

test('HTML backdrop is the only pointer close target', () => {
  const f = fixture();
  f.overlay.open();
  f.dialog.dispatchEvent(new Event('click'));
  assert.equal(f.dialog.dataset.state, 'open');
  f.backdrop.dispatchEvent(new Event('click'));
  assert.equal(f.dialog.dataset.state, 'closing');
});

test('backdrop custom cursor follows the pointer and hides inside the panel', () => {
  const f = fixture();
  f.overlay.open();
  const move = new Event('mousemove');
  Object.assign(move, { clientX: 450, clientY: 120 });
  f.backdrop.dispatchEvent(move);
  assert.equal(f.backdropCursor.classList.contains('active'), true);
  assert.equal(f.dialog.classList.contains('cursor-none'), true);
  assert.equal(f.backdropCursor.style['--cursor-x'], '450px');
  assert.equal(f.backdropCursor.style['--cursor-y'], '120px');
  f.backdrop.dispatchEvent(new Event('mouseleave'));
  assert.equal(f.backdropCursor.classList.contains('active'), false);
  assert.equal(f.dialog.classList.contains('cursor-none'), false);
});

test('short drag snaps back; downward threshold dismisses', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.gesture.start(f.pointer(0));
  f.tick(100);
  f.overlay.gesture.move(f.pointer(20));
  f.overlay.gesture.end(f.pointer(20));
  f.flushFrames();
  f.flushTimers();
  assert.equal(f.dialog.dataset.state, 'open');
  assert.equal(f.dialog.style.transform, undefined);
  f.overlay.gesture.start(f.pointer(0));
  f.tick(200);
  f.overlay.gesture.move(f.pointer(120));
  f.overlay.gesture.end(f.pointer(120));
  assert.equal(f.dialog.dataset.state, 'closing');
  f.flushFrames();
  f.flushTimers();
  assert.equal(f.dialog.open, false);
});

test('drag resistance and backdrop progress follow the panel movement', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.gesture.start(f.pointer(0, f.panel));
  f.tick(100);
  f.overlay.gesture.move(f.pointer(180, f.panel));
  const offset = Number.parseFloat(f.panel.style.transform.match(/, ([\d.]+)px/)[1]);
  assert.ok(offset > 100 && offset < 180);
  assert.equal(f.panel.style['--sheet-drag-progress'], String(offset / f.panel.offsetHeight));
  assert.equal(f.backdrop.style['--sheet-drag-progress'], f.panel.style['--sheet-drag-progress']);
  f.overlay.gesture.end(f.pointer(180, f.panel));
  assert.match(f.panel.style.transition, /opacity/);
  assert.equal(f.backdrop.style['--sheet-drag-progress'], '1');
  f.flushFrames();
  f.flushTimers();
  assert.equal(f.panel.style['--sheet-drag-progress'], undefined);
  assert.equal(f.backdrop.style['--sheet-drag-progress'], undefined);
});

test('panel surface drag dismisses while the sheet body is at scroll-top', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.gesture.start(f.pointer(0, f.panel));
  f.tick(100);
  f.overlay.gesture.move(f.pointer(180, f.panel));
  f.overlay.gesture.end(f.pointer(180, f.panel));
  assert.equal(f.dialog.dataset.state, 'closing');
});

test('sheet body scroll is preserved away from scroll-top and on upward drags', () => {
  const f = fixture();
  f.overlay.open();
  f.body.scrollTop = 24;
  f.overlay.gesture.start(f.pointer(0, f.body));
  assert.equal(f.overlay.gesture.drag, null);

  f.body.scrollTop = 0;
  f.overlay.gesture.start(f.pointer(100, f.body));
  f.tick(100);
  f.overlay.gesture.move(f.pointer(70, f.body));
  assert.equal(f.overlay.gesture.drag, null);
  assert.equal(f.dialog.dataset.state, 'open');
});

test('cancelled gesture and viewport change release capture without closing', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.gesture.start(f.pointer(0));
  f.overlay.gesture.move(f.pointer(180));
  f.overlay.gesture.end(f.pointer(180), true);
  f.flushFrames();
  f.flushTimers();
  assert.equal(f.dialog.open, true);
  f.overlay.gesture.start(f.pointer(0));
  f.media.matches = false;
  f.media.dispatchEvent(new Event('change'));
  assert.equal(f.panel.capture, null);
  assert.equal(f.dialog.style.transform, undefined);
});

test('desktop, drawer mode and interactive targets do not start sheet drag', () => {
  for (const variant of ['desktop', 'drawer', 'button']) {
    const f = fixture({ mobile: variant !== 'desktop' });
    f.overlay.open();
    if (variant === 'drawer') f.dialog.dataset.mobileLayout = 'drawer';
    const target = variant === 'button' ? { closest: () => ({}) } : f.header;
    f.overlay.gesture.start(f.pointer(0, target));
    assert.equal(f.overlay.gesture.drag, null);
  }
});

test('reduced motion closes synchronously without leaving drag styles or frames', () => {
  const f = fixture({ reduced: true });
  f.overlay.open();
  f.overlay.gesture.start(f.pointer(0));
  f.overlay.gesture.move(f.pointer(120));
  f.overlay.gesture.end(f.pointer(120));
  assert.equal(f.dialog.open, false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.dialog.style.transform, undefined);
});

test('destroy clears timers, listeners and cache without restoring stale focus', () => {
  const f = fixture();
  f.overlay.open();
  f.overlay.close();
  f.overlay.destroy();
  f.flushNative();
  f.flushTimers();
  assert.equal(f.dialog.open, false);
  assert.equal(f.opener.focusCount, undefined);
  assert.equal(f.opener.attributes['aria-expanded'], 'false');
  assert.notEqual(f.api.get(f.dialog), f.overlay);
});

test('append-to-body portals the dialog and restores its original parent on destroy', () => {
  const f = fixture({ portal: true });
  assert.equal(f.dialog.parentElement, f.document.body);
  f.overlay.destroy();
  assert.notEqual(f.dialog.parentElement, f.document.body);
});
