const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (data, ok = true) => ({ ok, json: async () => data });

function loadOverlayController(file, className, context) {
  // VM scripts cannot parse static ESM imports. Execute the real shared helper
  // in the same context, then remove only the import whose binding it supplies.
  const dependency = fs.readFileSync(path.join(__dirname, '../assets/button-loading.js'), 'utf8');
  assert.match(dependency, /^export function setButtonLoadingState\(/);
  vm.runInContext(dependency.replace(/^export /, ''), context);
  const source = fs.readFileSync(path.join(__dirname, `../assets/${file}.js`), 'utf8');
  const dependencyImport = "import { setButtonLoadingState } from './button-loading.js';";
  assert.equal(source.split(dependencyImport).length, 2);
  vm.runInContext(`${source.replace(dependencyImport, '')}\nwindow.Controller = ${className};`, context);
}

// Exercise the real delegated submit controller with deferred network responses.
// Native dialog/layout behavior is covered separately and needs browser QA.
function fixture({ assertReady = true, recommendationsEnabled = false } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      this.dataset = {};
      this.attributes = {};
      this.children = [];
      this.isConnected = true;
      this.disabled = false;
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, value) => value ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name),
      };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    append(child) { this.children.push(child); }
    contains(child) { return this.children.includes(child); }
  }
  const document = new Element();
  document.documentElement = { lang: 'en' };
  const drawer = new Element();
  drawer.dataset = {
    cartAddUrl: '/cart/add',
    cartUrl: '/cart',
    currency: 'USD',
    recommendationsEnabled: String(recommendationsEnabled),
  };
  const footer = new Element();
  footer.hidden = true;
  const items = new Element();
  drawer.querySelector = (selector) => ({
    '[data-cart-drawer-footer]': footer,
    '[data-cart-drawer-items]': items,
  })[selector] || null;
  document.querySelector = (selector) => selector === '[data-cart-drawer]' ? drawer : null;
  document.createElement = (tag) => {
    const element = new Element();
    if (tag === 'template') element.content = { firstElementChild: new Element() };
    return element;
  };
  const form = new Element();
  const button = new Element();
  const dots = new Element();
  dots.hidden = true;
  button.querySelector = (selector) => selector === '[data-loading-dots]' ? dots : null;
  const input = { value: '42' };
  form.closest = () => form;
  form.querySelector = (selector) => selector === '[name="id"]' ? input
    : form.children.find((child) => 'data-cart-add-error' in child.attributes) || null;
  form.querySelectorAll = () => [button];
  document.activeElement = button;
  const requests = [];
  const events = [];
  let opened = false;
  const overlay = {
    isOpen: () => opened,
    open(options) {
      if (assertReady) {
        assert.equal(footer.hidden, false, 'cart footer must be ready before opening');
        assert.equal(items.children.length, 1, 'cart line must be rendered before opening');
      }
      opened = true;
      events.push({ type: 'open', options });
    },
    close() { opened = false; },
    destroy() {},
  };
  const window = { ThemeOverlay: { get: () => overlay } };
  document.addEventListener('cart:add:ready', (event) => events.push({ type: 'ready', detail: event.detail }));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/cart-drawer.js'), 'utf8'), {
    document, window, Intl, Date, URLSearchParams,
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options.detail; } },
    FormData: class { get() { return input.value; } },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  });
  const submit = () => {
    const event = new Event('submit', { cancelable: true });
    Object.defineProperty(event, 'target', { value: form });
    event.submitter = button;
    document.dispatchEvent(event);
    return event;
  };
  const cart = {
    items: [{ key: '42:key', product_id: 42, title: 'Product', quantity: 1, price: 1000 }],
    item_count: 1,
    total_price: 1000,
  };
  return { document, drawer, form, button, dots, input, requests, events, submit, cart, items, footer, overlay, opened: () => opened };
}

test('add waits for POST and rendered cart, blocks double submit, and fetches cart only once', async () => {
  const f = fixture();
  assert.equal(f.submit().defaultPrevented, true);
  f.submit();
  assert.equal(f.requests.length, 1);
  assert.equal(f.opened(), false);
  assert.equal(f.button.disabled, true);
  assert.equal(f.form.attributes['aria-busy'], 'true');
  assert.equal(f.dots.hidden, false, 'Quick Add loading dots appear while the add is pending');
  f.requests[0].resolve(response({ id: 42 }));
  await tick();
  assert.equal(f.requests.length, 2);
  assert.equal(f.opened(), false);
  f.requests[1].resolve(response(f.cart));
  await tick();
  assert.deepEqual(f.events.map((event) => event.type), ['ready', 'open']);
  assert.equal(f.events[1].options.opener, f.button);
  assert.equal(f.requests.length, 2);
  assert.equal(f.button.disabled, false);
  assert.equal(f.dots.hidden, true);
  assert.equal(f.form.attributes['aria-busy'], undefined);
});

test('optional recommendations do not delay opening after the cart is rendered', async () => {
  const f = fixture({ recommendationsEnabled: true });
  f.submit();
  f.requests[0].resolve(response({ id: 42 }));
  await tick();
  f.requests[1].resolve(response(f.cart));
  await tick();
  assert.equal(f.opened(), true);
  assert.equal(f.requests.length, 3, 'recommendations may continue in the background');
  f.requests[2].resolve(response({ products: [] }));
  await tick();
});

test('sold out response stays in form, announces error, and permits retry', async () => {
  const f = fixture();
  f.submit();
  f.requests[0].resolve(response({ description: 'Sold out' }, false));
  await tick();
  assert.equal(f.opened(), false);
  assert.equal(f.events.length, 0);
  assert.equal(f.form.children[0].textContent, 'Sold out');
    assert.equal(f.form.children[0].attributes.role, 'alert');
    assert.equal(f.button.disabled, false);
    assert.equal(f.dots.hidden, true);
  f.submit();
  assert.equal(f.form.children[0].hidden, true);
  assert.equal(f.requests.length, 2);
});

test('tracked inventory replaces generic cart errors with the remaining quantity', async () => {
  const f = fixture();
  f.drawer.dataset.cartInventoryError = 'Only __COUNT__ left in stock.';
  f.form.dataset.inventoryQuantity = '3';
  f.form.dataset.inventoryManagement = 'shopify';
  f.form.dataset.inventoryPolicy = 'deny';
  f.submit();
  f.requests[0].resolve(response({ message: 'Cart Error' }, false));
  await tick();
  assert.equal(f.form.children[0].textContent, 'Only 3 left in stock.');
  assert.doesNotMatch(f.form.children[0].textContent, /Cart Error/);
});

test('tracked inventory reports the quantity still available after existing cart units', async () => {
  const f = fixture();
  const existingLine = {
    dataset: { variantId: '42', lineKey: 'existing-line' },
    querySelector: () => ({ value: '2' }),
  };
  f.drawer.querySelectorAll = (selector) => selector.includes('[data-cart-line]') ? [existingLine] : [];
  f.drawer.dataset.cartInventoryError = 'Only __COUNT__ left in stock.';
  f.form.dataset.inventoryQuantity = '3';
  f.form.dataset.inventoryManagement = 'shopify';
  f.form.dataset.inventoryPolicy = 'deny';
  f.submit();
  f.requests[0].resolve(response({ message: 'Cart Error' }, false));
  await tick();
  assert.equal(f.form.children[0].textContent, 'Only 1 left in stock.');
});

test('network or cart refresh failure never opens the drawer and clears busy state', async () => {
  for (const failCart of [false, true]) {
    const f = fixture();
    f.submit();
    if (failCart) {
      f.requests[0].resolve(response({ id: 42 }));
      await tick();
      f.requests[1].reject(new Error('Cart unavailable'));
    } else f.requests[0].reject(new Error('Offline'));
    await tick();
    assert.equal(f.opened(), false);
    assert.equal(f.form.attributes['aria-busy'], undefined);
    assert.equal(f.button.disabled, false);
    assert.ok(f.form.children[0].textContent);
  }
});

test('unavailable variant is not posted and a variant becoming sold out remains disabled', async () => {
  const f = fixture();
  f.form.dataset.variantAvailable = 'false';
  f.submit();
  assert.equal(f.requests.length, 0);
  f.form.dataset.variantAvailable = 'true';
  f.submit();
  f.button.dataset.variantAvailable = 'false';
  f.requests[0].resolve(response({ description: 'Sold out' }, false));
  await tick();
  assert.equal(f.button.disabled, true);
});

test('drawer unload while adding does not open or update a removed drawer', async () => {
  const f = fixture();
  f.submit();
  const unload = new Event('shopify:section:unload');
  Object.defineProperty(unload, 'target', { value: f.drawer });
  f.document.dispatchEvent(unload);
  f.requests[0].resolve(response({ id: 42 }));
  await tick();
  assert.equal(f.events.length, 0);
  assert.equal(f.requests.length, 1);
  assert.equal(f.button.disabled, false);
});

test('a header refresh started before add cannot overwrite the newly rendered cart', async () => {
  const f = fixture({ assertReady: false });
  const trigger = { closest: () => trigger };
  const click = new Event('click', { cancelable: true });
  Object.defineProperty(click, 'target', { value: trigger });
  f.document.dispatchEvent(click);
  assert.equal(f.requests.length, 1);
  f.overlay.close();
  f.submit();
  f.requests[1].resolve(response({ id: 42 }));
  await tick();
  f.requests[2].resolve(response(f.cart));
  await tick();
  assert.equal(f.items.children.length, 1);
  assert.equal(f.footer.hidden, false);
  f.requests[0].resolve(response({ items: [], item_count: 0 }));
  await tick();
  assert.equal(f.footer.hidden, false);
  assert.equal(f.items.hidden, false);
  assert.equal(f.requests.length, 3);
});

test('Quick Add and Quick View close only on cart readiness and hand off the external opener', () => {
  for (const [file, className] of [['quick-add', 'QuickAddController'], ['quick-view', 'QuickViewController']]) {
    const document = new EventTarget();
    document.querySelector = () => null;
    const window = {};
    const context = vm.createContext({ document, window, AbortController });
    loadOverlayController(file, className, context);
    const form = { querySelector: () => ({ value: '42' }) };
    const calls = [];
    const opener = {};
    const dialog = new EventTarget();
    dialog.closest = () => null;
    dialog.contains = (element) => element === form;
    const overlay = { close: (options) => calls.push(options) };
    window.ThemeOverlay = { get: () => overlay };
    const controller = new window.Controller(dialog);
    controller.opener = opener;
    document.dispatchEvent(new Event('submit'));
    assert.equal(calls.length, 0);
    const ready = new Event('cart:add:ready');
    ready.detail = { form, opener: {} };
    document.dispatchEvent(ready);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].immediate, true);
    assert.equal(calls[0].restoreFocus, false);
    assert.equal(ready.detail.opener, opener);
    controller.abortController.abort();
  }
});

test('Quick Add trigger dots clear when its overlay controller is destroyed', () => {
  const document = new EventTarget();
  document.querySelector = () => null;
  const window = { ThemeOverlay: { get: () => ({ destroy() {} }) } };
  const context = vm.createContext({ document, window, AbortController });
  loadOverlayController('quick-add', 'QuickAddController', context);

  const classes = new Set(['hidden']);
  const dots = {
    hidden: true,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    },
  };
  const wrapper = { dataset: {} };
  const attributes = {};
  const triggerClasses = new Set();
  const trigger = {
    dataset: {},
    classList: { toggle: (name, enabled) => enabled ? triggerClasses.add(name) : triggerClasses.delete(name) },
    closest: () => wrapper,
    querySelector: (selector) => selector === '[data-loading-dots]' ? dots : null,
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; },
    removeAttribute: (name) => { delete attributes[name]; },
  };
  const dialog = new EventTarget();
  dialog.closest = () => null;
  dialog.querySelector = () => null;
  dialog.removeAttribute = () => {};
  const controller = new window.Controller(dialog);
  let aborted = false;
  controller.requestController = { abort: () => { aborted = true; } };
  controller.setTriggerLoading(trigger, true);
  assert.equal(dots.hidden, false);
  assert.equal(classes.has('hidden'), false);
  assert.equal(wrapper.dataset.quickAddLoading, 'true');
  assert.equal(attributes['aria-busy'], 'true');
  assert.equal(triggerClasses.has('btn--loading'), true);

  controller.destroy();
  assert.equal(aborted, true);
  assert.equal(dots.hidden, true);
  assert.equal(classes.has('hidden'), true);
  assert.equal(trigger.dataset.quickAddLoading, undefined);
  assert.equal(wrapper.dataset.quickAddLoading, undefined);
  assert.equal(attributes['aria-busy'], undefined);
  assert.equal(triggerClasses.has('btn--loading'), false);
});
