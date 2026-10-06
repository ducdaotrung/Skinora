const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/accordion-details.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ boxSizing = 'border-box', reduced = false, initiallyOpen = false, mobileOnly = false, desktop = false } = {}) {
  const animations = [];
  const eventTarget = () => ({
    handlers: {},
    addEventListener(name, handler, options) {
      (this.handlers[name] ||= new Set()).add(handler);
      options?.signal?.addEventListener('abort', () => this.handlers[name].delete(handler));
    },
    dispatchEvent(event) { this.handlers[event.type]?.forEach(handler => handler(event)); },
    setAttribute(name, value) { this[name] = value; },
    style: { removeProperty(name) { delete this[name]; } },
    animate(frames) {
      let resolve;
      const animation = { frames, canceled: false, finished: new Promise(r => resolve = r), cancel() { this.canceled = true; }, finish() { resolve(); } };
      animations.push(animation); return animation;
    },
  });
  const content = eventTarget();
  const summary = { ...eventTarget(), nextElementSibling: content, getBoundingClientRect: () => ({ height: 27 }) };
  const details = { ...eventTarget(), dataset: { accordionState: initiallyOpen ? 'open' : 'closed' }, open: initiallyOpen, isConnected: true,
    hasAttribute: name => name === 'data-accordion-mobile-only' && mobileOnly,
    querySelector: () => summary,
    matches: () => true,
    querySelectorAll: () => [],
    getBoundingClientRect() { return { height: this.style.height ? Number.parseFloat(this.style.height) + (boxSizing === 'content-box' ? 42 : 0) : (this.open ? 240 : 69) }; },
  };
  const media = { matches: reduced, addEventListener() {}, removeEventListener() {} };
  const document = { ...eventTarget(), readyState: 'complete', querySelectorAll: () => [details] };
  const window = { matchMedia: query => query.includes('reduce') ? media : { ...media, matches: desktop }, Shopify: { designMode: true }, addEventListener() {} };
  vm.runInNewContext(source, { document, window, AbortController, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    getComputedStyle: el => el === details ? { boxSizing, paddingTop: '20px', paddingBottom: '20px', borderTopWidth: '1px', borderBottomWidth: '1px' } : { opacity: '1', transform: 'none' },
  });
  const click = () => summary.dispatchEvent({ type: 'click', preventDefault() {} });
  const finish = async () => { animations.filter(a => !a.canceled).forEach(a => a.finish()); await tick(); };
  return { details, summary, content, animations, click, finish, window };
}
for (const boxSizing of ['border-box', 'content-box']) {
  test(`padded ${boxSizing} disclosure settles at natural height without retained animation effects`, async () => {
    const f = fixture({ boxSizing }); f.click();
    const inset = boxSizing === 'border-box' ? 0 : 42;
    assert.deepEqual(JSON.parse(JSON.stringify(f.animations[0].frames)), [{ height: `${69 - inset}px` }, { height: `${240 - inset}px` }]);
    await f.finish();
    assert.equal(f.details.open, true); assert.equal(f.summary['aria-expanded'], 'true');
    assert.ok(f.animations.every(a => a.canceled)); assert.equal(f.details.style.height, undefined);
    f.click(); assert.equal(f.details.dataset.accordionState, 'closed');
    assert.equal(f.animations.at(-1).frames[1].height, `${69 - inset}px`);
    await f.finish(); assert.equal(f.details.open, false); assert.equal(f.details.getBoundingClientRect().height, 69);
    assert.ok(f.animations.every(a => a.canceled)); assert.equal(f.content.style.opacity, undefined);
  });
}
test('rapid open-close-open ignores stale finishes and clears all effects', async () => {
  const f = fixture(); f.click(); f.click(); f.click();
  f.animations.forEach(a => a.finish()); await tick();
  assert.equal(f.details.open, true); assert.equal(f.details.dataset.accordionState, 'open');
  assert.equal(f.summary['aria-expanded'], 'true'); assert.ok(f.animations.every(a => a.canceled));
  assert.equal(f.details.style.height, undefined);
});
test('reduced motion and Theme Editor selection use accessible static state', () => {
  const f = fixture({ reduced: true }); f.click(); assert.equal(f.details.open, true); assert.equal(f.animations.length, 0);
  f.details.dispatchEvent({ type: 'shopify:block:deselect' }); assert.equal(f.details.open, false);
  f.details.dispatchEvent({ type: 'shopify:block:select' }); assert.equal(f.details.open, true);
  f.window.__themeAccordionDetailsController.cleanupRoot(f.details); f.click(); assert.equal(f.details.open, true);
  f.window.__themeAccordionDetailsController.initializeRoot(f.details); f.click(); assert.equal(f.details.open, false);
});
test('mobile-only disclosure preserves desktop expansion', () => {
  const f = fixture({ mobileOnly: true, desktop: true });
  assert.equal(f.details.open, true); f.click(); assert.equal(f.details.open, true); assert.equal(f.animations.length, 0);
});
