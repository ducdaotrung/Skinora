const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');

function fixture(boxedLayout = true) {
  const node = (dataset = {}, classes = []) => ({
    dataset, attrs: {}, listeners: {}, classList: { values: new Set(classes), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); } },
    style: { values: new Map(), setProperty(key, value) { this.values.set(key, value); }, removeProperty(key) { this.values.delete(key); } },
    setAttribute(key, value) { this.attrs[key] = value; }, getAttribute(key) { return this.attrs[key]; },
    addEventListener(name, handler) { this.listeners[name] = handler; }, focus() {}, contains() { return false; }
  });
  const tabs = ['a', 'b', 'c'].map((id) => node({ collectionsWithTabsId: id }));
  const panels = [
    node({ collectionsWithTabsId: 'a', collectionsWithTabsColorScheme: 'scheme-3', collectionsWithTabsBackground: '#edeae2' }),
    node({ collectionsWithTabsId: 'b', collectionsWithTabsColorScheme: '', collectionsWithTabsBackground: '' }),
    node({ collectionsWithTabsId: 'c', collectionsWithTabsColorScheme: 'scheme-4', collectionsWithTabsBackground: '' })
  ];
  const boxed = node({ collectionsWithTabsBaseScheme: 'scheme-2' }, ['scheme-2']);
  const root = node({ collectionsWithTabsBaseScheme: 'scheme-1', autoRotate: 'false' }, ['scheme-1']);
  root.querySelector = () => boxedLayout ? boxed : null;
  root.querySelectorAll = (selector) => selector.includes('tab]') ? tabs : selector.includes('panel]') ? panels : [boxed];
  const document = { hidden: false, readyState: 'complete', addEventListener() {}, querySelectorAll() { return []; } };
  const window = { clearTimeout() {}, cancelAnimationFrame() {}, requestAnimationFrame(handler) { handler(); return 1; }, matchMedia() { return { matches: false }; } };
  const context = { document, window, AbortController, root, performance: { now: () => 0 } };
  vm.runInNewContext(fs.readFileSync('assets/collections-with-tabs.js', 'utf8') + '\ninitialize(root);', context);
  return { root, boxed, tabs, panels, activate(id) { root.listeners['collections-with-tabs:activate']({ detail: { id } }); } };
}

test('boxed active scheme and custom background affect the box while outer section stays unchanged', () => {
  const { root, boxed } = fixture();
  assert.deepEqual([...boxed.classList.values], ['scheme-3']);
  assert.equal(boxed.style.values.get('--background-color'), '#edeae2');
  assert.deepEqual([...root.classList.values], ['scheme-1']);
  assert.equal(root.style.values.has('--background-color'), false);
});
test('unboxed active scheme and custom background affect the whole section', () => {
  const { root, activate } = fixture(false);
  assert.deepEqual([...root.classList.values], ['scheme-3']);
  assert.equal(root.style.values.get('--background-color'), '#edeae2');
  activate('b');
  assert.deepEqual([...root.classList.values], ['scheme-1']);
  assert.equal(root.style.values.has('--background-color'), false);
});
test('switching to inherit restores distinct section and boxed fallbacks and clears background', () => {
  const { root, boxed, activate } = fixture();
  activate('b');
  assert.deepEqual([...root.classList.values], ['scheme-1']);
  assert.deepEqual([...boxed.classList.values], ['scheme-2']);
  for (const scope of [root, boxed]) assert.equal(scope.style.values.has('--background-color'), false);
  activate('c');
  assert.deepEqual([...boxed.classList.values], ['scheme-4']);
  assert.deepEqual([...root.classList.values], ['scheme-1']);
});
test('keyboard activation uses the same color path and selects matching panel', () => {
  const { root, boxed, tabs, panels } = fixture();
  root.listeners.keydown({ target: { closest: () => tabs[0] }, key: 'End', preventDefault() {} });
  assert.equal(tabs[2].attrs['aria-selected'], 'true');
  assert.equal(panels[2].dataset.active, 'true');
  assert.deepEqual([...boxed.classList.values], ['scheme-4']);
  assert.deepEqual([...root.classList.values], ['scheme-1']);
});
test('Liquid accepts color scheme objects and strings and ignores saved scheme when inheriting', () => {
  const Liquid = loadLiquid();
  const engine = new Liquid({ strictFilters: false });
  engine.registerFilter('handleize', (value) => String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
  engine.registerFilter('placeholder_svg_tag', () => '<svg></svg>');
  const source = stripShopifyMetadata(fs.readFileSync('blocks/collections-with-tabs-item.liquid', 'utf8'));
  const render = (settings) => engine.parseAndRenderSync(source, { block: { id: 'a', settings }, section: { settings: {} } });
  assert.match(render({ color_type: 'color_scheme', color_scheme: { id: 'scheme-3' } }), /data-collections-with-tabs-color-scheme="scheme-3"/);
  assert.match(render({ color_type: 'color_scheme', color_scheme: 'scheme-4' }), /data-collections-with-tabs-color-scheme="scheme-4"/);
  assert.match(render({ color_type: 'inherit', color_scheme: 'scheme-4', custom_background: true, background_color: '#edeae2' }), /data-collections-with-tabs-color-scheme="" data-collections-with-tabs-background="#edeae2"/);
  assert.match(render({ color_type: 'inherit', background_color: '#edeae2' }), /data-collections-with-tabs-background=""/);
});
