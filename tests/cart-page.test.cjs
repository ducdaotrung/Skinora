const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/cart-page.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(cart = { items: [], discount_codes: [] }) {
  const handlers = {};
  const calls = [];
  const output = { hidden: true, textContent: '', setAttribute() {} };
  const root = { dataset: { updateError: 'Update failed', discountError: 'Invalid code', noteSaved: 'Saved', sectionId: 'main' }, setAttribute() {}, removeAttribute() {}, querySelector: () => output };
  const api = {
    mutate: async (operation, payload) => { calls.push({ operation, payload }); return cart; },
    getStoredDiscountCodes: cart => (cart.discount_codes || []).map(d => d.code),
    mergeDiscountCodes: (...codes) => [...new Set(codes.flat())],
    isDiscountApplied: (cart, code) => cart.discount_codes.some(d => d.code === code && d.applicable),
  };
  const document = { addEventListener: (name, fn) => handlers[name] = fn, querySelector: () => root };
  class FormData { constructor(form) { this.form = form; } get(key) { return this.form.values[key]; } }
  vm.runInNewContext(source, { window: { __cartDrawerController: api, Shopify: { routes: { root: '/' } } }, document, FormData, URLSearchParams, fetch: async () => ({ ok: true, json: async () => cart }) });
  const submit = (kind, values, dataset = {}) => handlers.submit({ preventDefault() {}, target: { values, dataset, matches: () => true, hasAttribute: attr => attr === `data-cart-page-${kind}` } });
  return { handlers, calls, output, api, root, submit };
}
test('quantity mutation uses stable line key and locks concurrent clicks through failed request', async () => {
  const f = fixture(); let reject;
  f.api.mutate = (operation, payload) => { f.calls.push({ operation, payload }); return new Promise((_, r) => reject = r); };
  const line = { dataset: { lineKey: '42:properties-hash' }, querySelector: () => ({ value: '3' }) };
  const target = { dataset: { cartPageStep: '1' }, closest: selector => selector === '[data-cart-page-line]' ? line : f.root, hasAttribute: attr => attr === 'data-cart-page-step' };
  const event = { target: { closest: selector => selector === '[data-cart-page-edit-open]' ? null : target }, preventDefault() {} };
  f.handlers.click(event); f.handlers.click(event);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [{ operation: 'change', payload: { id: '42:properties-hash', quantity: 4 } }]);
  reject(new Error('Inventory unavailable')); await tick();
  assert.equal(f.output.textContent, 'Inventory unavailable'); assert.equal(f.output.hidden, false);
});
test('invalid discount restores previous codes instead of clearing merchant cart discounts', async () => {
  const f = fixture({ items: [], discount_codes: [{ code: 'CODE10', applicable: true }] });
  f.submit('discount', { discount: 'INVALID' }); await tick(); await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [{ operation: 'update', payload: { discount: 'CODE10,INVALID' } }, { operation: 'update', payload: { discount: 'CODE10' } }]);
  assert.equal(f.output.textContent, 'Invalid code');
});
test('variant replacement preserves properties and selling plan; failed add does not remove original', async () => {
  const original = { key: '42:custom', variant_id: 42, quantity: 3, properties: { Engraving: 'A&B' }, selling_plan_allocation: { selling_plan: { id: 99 } } };
  const f = fixture({ items: [original] });
  f.api.mutate = async (operation, payload) => { f.calls.push({ operation, payload }); throw new Error('Sold out'); };
  f.submit('edit', { id: '43' }, { lineKey: original.key }); await tick();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].operation, 'add');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].payload.items[0])), { id: 43, quantity: 3, properties: original.properties, selling_plan: 99 });
  assert.equal(f.output.textContent, 'Sold out');
});
test('note update announces server failure and allows retry', async () => {
  const f = fixture(); f.api.mutate = async () => { throw new Error('Offline'); };
  f.submit('note', { note: 'Fragile' }); await tick(); assert.equal(f.output.textContent, 'Offline');
  f.api.mutate = async (operation, payload) => f.calls.push({ operation, payload });
  f.submit('note', { note: 'Fragile' }); await tick(); assert.equal(f.output.textContent, 'Saved');
});
test('replacement remove failure rolls back only the added quantity of an existing matching line', async () => {
  const old = { key: '42:old', variant_id: 42, quantity: 2, properties: { Gift: 'yes' } };
  const existing = { key: '43:existing', variant_id: 43, quantity: 4, properties: { Gift: 'yes' } };
  const f = fixture({ items: [old, existing] });
  f.api.mutate = async (operation, payload) => {
    f.calls.push({ operation, payload });
    if (operation === 'add') return { items: [old, { ...existing, quantity: 6 }] };
    if (payload.id === old.key) throw new Error('Remove failed');
    return { items: [old, existing] };
  };
  f.submit('edit', { id: '43', quantity: '2' }, { lineKey: old.key }); await tick(); await tick();
  assert.equal(f.calls.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[2])), { operation: 'change', payload: { id: existing.key, quantity: 4 } });
  assert.equal(f.output.textContent, 'Remove failed');
});
test('section refresh restores declared accordion state before initializing new disclosures', async () => {
  const calls = [];
  const summary = { textContent: 'Order note' };
  const oldTool = { querySelector: () => summary };
  const newTool = { dataset: { accordionState: 'closed' }, open: false, querySelector: () => summary, hasAttribute: name => name === 'data-accordion-details' };
  const next = { querySelectorAll: () => [newTool] };
  const current = { dataset: { sectionId: 'main' }, querySelectorAll: selector => selector === 'details[open]' ? [oldTool] : [], replaceWith: node => { assert.equal(node, next); calls.push('replace'); } };
  const window = { location: { href: 'https://example.com/cart' }, __themeAccordionDetailsController: {
    cleanupRoot: node => { assert.equal(node, current); calls.push('cleanup'); },
    initializeRoot: node => { assert.equal(node, next); assert.equal(newTool.open, true); assert.equal(newTool.dataset.accordionState, 'open'); calls.push('initialize'); },
  } };
  const document = { addEventListener() {}, querySelector: () => current, activeElement: null };
  vm.runInNewContext(source, { window, document, URL, fetch: async () => ({ ok: true, text: async () => '<html>' }), DOMParser: class { parseFromString() { return { querySelector: () => next }; } } });
  await window.__cartPageController.refresh();
  assert.deepEqual(calls, ['cleanup', 'replace', 'initialize']);
});
