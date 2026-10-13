const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../assets/recently-viewed.js'), 'utf8');
function fixture({ data = [], viewed, search = true, limit = 4, blocked = false, fetchImpl } = {}) {
  const grid = { children: [], append(card) { this.children.push(card); }, dispatchEvent() {} };
  const root = { dataset: { limit: String(limit) }, hidden: true, isConnected: true, querySelector: () => grid };
  const doc = new EventTarget();
  doc.querySelector = () => viewed ? { dataset: { productUrl: viewed } } : null;
  doc.querySelectorAll = () => search ? [root] : [];
  let stored = JSON.stringify(data);
  const requests = [];
  vm.runInNewContext(script, {
    document: doc, URL, AbortController, CustomEvent: class extends Event {},
    localStorage: { getItem() { if (blocked) throw new Error(); return stored; }, setItem(k, value) { if (blocked) throw new Error(); stored = value; } },
    window: { location: { origin: 'https://shop.test' } },
    fetch: async (url, options) => { requests.push({ url, options }); return fetchImpl ? fetchImpl(url, options) : { ok: true, text: async () => String(url) }; },
    DOMParser: class { parseFromString(html) { return { querySelector: () => ({ content: { cloneNode: () => html } }) }; } }
  });
  return { root, grid, requests, stored: () => JSON.parse(stored), doc };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
test('records product once at front without any product-page network request', () => {
  const f = fixture({ data: ['/products/one', '/products/two'], viewed: '/products/two', search: false });
  assert.deepEqual(f.stored(), ['/products/two', '/products/one']); assert.equal(f.requests.length, 0);
});
test('bounds and validates paths, skips errors while preserving history order', async () => {
  const f = fixture({ data: ['https://evil.test/products/x', '/products/one', '/products/two', '/products/three', '/products/four', '/products/five'], fetchImpl: async (url) => ({ ok: !url.pathname.endsWith('two'), text: async () => url.pathname }) });
  await settle();
  assert.equal(f.requests.length, 4);
  assert.ok(f.requests.every(({ url }) => url.origin === 'https://shop.test' && url.searchParams.get('section_id') === 'recently-viewed-card'));
  assert.deepEqual(f.grid.children, ['/products/one', '/products/three', '/products/four']); assert.equal(f.root.hidden, false);
});
test('blocked local storage leaves empty-state hidden and makes no requests', async () => {
  const f = fixture({ blocked: true, viewed: '/products/one' }); await settle();
  assert.equal(f.requests.length, 0); assert.equal(f.root.hidden, true);
});
test('editor unload cancels pending responses before DOM insertion', async () => {
  let respond;
  const f = fixture({ data: ['/products/one'], fetchImpl: () => new Promise((resolve) => { respond = resolve; }) });
  const parent = { matches: () => true, querySelectorAll: () => [] };
  // The search root itself is the lifecycle target.
  f.root.matches = () => true; f.root.querySelectorAll = () => [];
  const event = new Event('shopify:section:unload'); Object.defineProperty(event, 'target', { value: f.root }); f.doc.dispatchEvent(event);
  respond({ ok: true, text: async () => 'card' }); await settle();
  assert.equal(f.requests[0].options.signal.aborted, true); assert.equal(f.grid.children.length, 0);
});

test('configured recent count bounds rows to two even when history has more', async () => {
  const f = fixture({ data: ['/products/one', '/products/two', '/products/three'], limit: 2 });
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.grid.children.length, 2);
});
