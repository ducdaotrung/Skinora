const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real render, observer and loadMore methods. Layout and native
// dialog behavior are covered separately; this fixture models DOM replacement.
function fixture() {
  class Element extends EventTarget {
    constructor() {
      super();
      this.dataset = {};
      this.attributes = {};
      this.isConnected = true;
      this.classList = { contains: () => false };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
  }
  const definitions = new Map();
  const requests = [];
  const observers = [];
  const navigations = [];
  const frames = [];
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; this.disconnected = false; }
    disconnect() { this.disconnected = true; }
    intersect() { this.callback([{ isIntersecting: true }]); }
  }
  const window = {
    location: { origin: 'https://shop.example', href: 'https://shop.example/collections/all', assign: (url) => navigations.push(String(url)) },
    history: { pushState() {} },
    IntersectionObserver: Observer,
    requestAnimationFrame: (callback) => frames.push(callback),
    clearTimeout() {}, removeEventListener() {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/section-collection.js'), 'utf8'), {
    HTMLElement: Element, window, URL, AbortController, IntersectionObserver: Observer,
    document: { removeEventListener() {} }, cancelAnimationFrame() {},
    customElements: { get: (name) => definitions.get(name), define: (name, type) => definitions.set(name, type) },
    DOMParser: class { parseFromString(html) { return { querySelector: () => html }; } },
    CustomEvent: class extends Event {},
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  });
  const facets = new (definitions.get('collection-facets'))();
  facets.sectionId = 'collection';
  facets.dialog = new Element();
  facets.dialog.open = true;
  const body = new Element();
  body.scrollTop = 120;
  facets.dialog.querySelector = (selector) => selector === '.main-collection__filter-body' ? body : null;
  for (const method of ['syncColumns', 'updateFilterGroups', 'updateSidebarSticky', 'scrollAfterUpdate']) facets[method] = () => {};
  const toolbar = new Element();
  toolbar.replaceWith = () => {};
  let currentProducts;
  function products(page, hasNext = true) {
    const node = new Element();
    node.grid = new Element();
    node.grid.items = [new Element()];
    node.grid.items[0].style = {};
    node.grid.querySelectorAll = () => node.grid.items;
    node.grid.append = (item) => node.grid.items.push(item);
    node.pagination = new Element();
    node.status = new Element();
    node.status.hidden = true;
    node.sentinel = new Element();
    node.link = hasNext ? new Element() : null;
    if (node.link) {
      node.link.href = `https://shop.example/collections/all?filter.v.option.color=red&page=${page + 1}`;
      node.link.closest = () => node.pagination;
    }
    node.pagination.querySelector = (selector) => ({
      '[data-collection-infinite-sentinel]': node.sentinel,
      '[data-collection-load-more]': node.link,
      '[data-collection-pagination-status]': node.status,
    })[selector] || null;
    node.pagination.replaceWith = (next) => { node.pagination = next; };
    node.pagination.remove = () => { node.pagination = null; };
    node.replaceWith = (next) => { currentProducts = next; };
    return node;
  }
  currentProducts = products(1);
  facets.querySelector = (selector) => ({
    '.main-collection__filter-body': body,
    '.main-collection__toolbar': toolbar,
    '.main-collection__products': currentProducts,
    '.main-collection__grid': currentProducts.grid,
    '.collection-pagination-block': currentProducts.pagination,
    '[data-pagination-mode="infinite"]': currentProducts.pagination,
  })[selector] || null;
  function response(page = 1, hasNext = true) {
    const nextProducts = products(page, hasNext);
    const next = new Element();
    next.querySelector = (selector) => ({
      '[data-collection-filter-dialog]': new Element(),
      '.main-collection__toolbar': toolbar,
      '.main-collection__products': nextProducts,
      '.collection-pagination-block': nextProducts.pagination,
    })[selector] || null;
    next.querySelectorAll = () => nextProducts.grid.items;
    return { ok: true, text: async () => next };
  }
  facets.observePagination();
  return { facets, requests, observers, navigations, response, createProducts: products, products: () => currentProducts };
}

test('open-dialog facet update reobserves the new sentinel and requests the next page', async () => {
  const f = fixture();
  const previousObserver = f.observers[0];
  const render = f.facets.render('/collections/all?filter.v.option.color=red');
  assert.equal(previousObserver.disconnected, true);
  assert.equal(f.facets.attributes['aria-busy'], 'true');
  // A queued callback from the disconnected observer must not paginate mid-filter.
  previousObserver.intersect();
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve(f.response());
  await render;
  assert.equal(f.facets.dialog.open, true);
  assert.equal(f.facets.requestController, null);
  assert.equal(f.facets.attributes['aria-busy'], undefined);
  assert.equal(f.observers.length, 2);
  assert.equal(f.observers[1].target, f.products().sentinel);
  f.observers[1].intersect();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].url.searchParams.get('page'), '2');
  assert.equal(f.requests[1].url.searchParams.get('filter.v.option.color'), 'red');
  f.requests[1].resolve(f.response(2, false));
  await new Promise(setImmediate);
  assert.equal(f.products().grid.items.length, 2);
  assert.equal(f.facets.loadingMore, false);
  assert.equal(f.products().pagination, null);
});

test('superseded render cannot clear the active controller or resume pagination early', async () => {
  const f = fixture();
  const first = f.facets.render('/collections/all?filter.v.option.color=blue');
  const second = f.facets.render('/collections/all?filter.v.option.color=red');
  const activeController = f.facets.requestController;
  assert.equal(f.requests[0].options.signal.aborted, true);
  // Also cover an aborted fetch that still resolves, as can happen after the
  // response arrived but before async response processing has completed.
  f.requests[0].resolve(f.response());
  await first;
  assert.equal(f.facets.requestController, activeController);
  assert.equal(f.facets.attributes['aria-busy'], 'true');
  assert.equal(f.observers.length, 1);
  f.requests[1].resolve(f.response());
  await second;
  assert.equal(f.facets.requestController, null);
  assert.equal(f.observers.length, 2);
});

test('failed render clears busy state and preserves navigation fallback', async () => {
  const f = fixture();
  const render = f.facets.render('/collections/all?filter.v.option.color=red');
  f.requests[0].resolve({ ok: false, status: 500 });
  await render;
  assert.equal(f.facets.requestController, null);
  assert.equal(f.facets.attributes['aria-busy'], undefined);
  assert.deepEqual(f.navigations, ['https://shop.example/collections/all?filter.v.option.color=red']);
  assert.equal(f.observers.length, 2);
});

test('aborted disconnected render clears its controller without attaching an observer', async () => {
  const f = fixture();
  const render = f.facets.render('/collections/all?filter.v.option.color=red');
  f.facets.isConnected = false;
  f.facets.requestController.abort();
  const error = new Error('Aborted');
  error.name = 'AbortError';
  f.requests[0].reject(error);
  await render;
  assert.equal(f.facets.requestController, null);
  assert.equal(f.facets.attributes['aria-busy'], undefined);
  assert.equal(f.observers.length, 1);
  assert.equal(f.navigations.length, 0);
});

test('late load-more response cannot append old products or replace new pagination after a facet update', async () => {
  const f = fixture();
  const oldLink = f.products().link;
  const pagination = f.facets.loadMore(oldLink);
  const render = f.facets.render('/collections/all?filter.v.option.color=blue');
  f.requests[1].resolve(f.response());
  await render;
  const currentProducts = f.products();
  const currentPagination = currentProducts.pagination;
  f.requests[0].resolve(f.response(2, false));
  await pagination;
  assert.equal(currentProducts.grid.items.length, 1);
  assert.equal(currentProducts.pagination, currentPagination);
  assert.equal(f.navigations.length, 0);
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(oldLink.attributes['aria-busy'], undefined);
});

test('old pagination body completion cannot clear a newer load-more request', async () => {
  const f = fixture();
  let resolveBody;
  const oldPagination = f.facets.loadMore(f.products().link);
  const oldResponse = f.response(2, false);
  f.requests[0].resolve({ ok: true, text: () => new Promise(resolve => { resolveBody = resolve; }) });
  await new Promise(setImmediate);
  const render = f.facets.render('/collections/all?filter.v.option.color=blue');
  f.requests[1].resolve(f.response());
  await render;
  const currentLink = f.products().link;
  const newPagination = f.facets.loadMore(currentLink);
  assert.equal(f.requests.length, 3);
  resolveBody(await oldResponse.text());
  await oldPagination;
  assert.equal(f.products().grid.items.length, 1);
  assert.equal(f.facets.loadingMore, true);
  assert.equal(currentLink.attributes['aria-busy'], 'true');
  assert.equal(f.products().status.hidden, false);
  f.requests[2].resolve(f.response(2, false));
  await newPagination;
  assert.equal(f.products().grid.items.length, 2);
  assert.equal(f.facets.loadingMore, false);
  assert.equal(f.products().status.hidden, true);
});

test('late pagination failure cannot navigate away from a newer facet render', async () => {
  const f = fixture();
  const pagination = f.facets.loadMore(f.products().link);
  const render = f.facets.render('/collections/all?filter.v.option.color=blue');
  f.requests[0].reject(new Error('Late network failure'));
  await pagination;
  assert.equal(f.navigations.length, 0);
  assert.equal(f.facets.attributes['aria-busy'], 'true');
  f.requests[1].resolve(f.response());
  await render;
});

test('queued old observer and old load-more link cannot paginate the new filter results', async () => {
  const f = fixture();
  const oldObserver = f.observers[0];
  const oldLink = f.products().link;
  const render = f.facets.render('/collections/all?filter.v.option.color=blue');
  f.requests[0].resolve(f.response());
  await render;
  oldObserver.intersect();
  await f.facets.loadMore(oldLink);
  assert.equal(f.requests.length, 1);
  const pagination = f.facets.loadMore(f.products().link);
  f.requests[1].resolve(f.response(2, false));
  await pagination;
  assert.equal(f.products().grid.items.length, 2);
});

test('disconnect aborts pagination and rejects its response even after reconnect', async () => {
  const f = fixture();
  const link = f.products().link;
  const pagination = f.facets.loadMore(link);
  for (const method of ['finishSidebarTransition', 'destroySidebarSticky', 'finishCloseDialog']) f.facets[method] = () => {};
  f.facets.isConnected = false;
  f.facets.disconnectedCallback();
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.facets.loadingMore, false);
  assert.equal(link.attributes['aria-busy'], undefined);
  f.facets.isConnected = true;
  f.requests[0].resolve(f.response(2, false));
  await pagination;
  assert.equal(f.products().grid.items.length, 1);
  assert.equal(f.navigations.length, 0);
  assert.equal(f.observers.length, 1);
});

test('active pagination failure preserves navigation fallback and releases busy state', async () => {
  const f = fixture();
  const link = f.products().link;
  const pagination = f.facets.loadMore(link);
  f.requests[0].resolve({ ok: false });
  await pagination;
  assert.deepEqual(f.navigations, [link.href]);
  assert.equal(f.facets.loadingMore, false);
  assert.equal(f.facets.paginationController, null);
  assert.equal(link.attributes['aria-busy'], undefined);
});

test('superseded render late failure cannot trigger navigation fallback', async () => {
  const f = fixture();
  const first = f.facets.render('/collections/all?filter.v.option.color=blue');
  const second = f.facets.render('/collections/all?filter.v.option.color=red', { updateHistory: false });
  f.requests[0].reject(new Error('Late network failure'));
  await first;
  assert.equal(f.navigations.length, 0);
  assert.equal(f.facets.attributes['aria-busy'], 'true');
  f.requests[1].resolve(f.response());
  await second;
});

test('pagination response cannot mutate DOM replaced outside its request generation', async () => {
  const f = fixture();
  const oldProducts = f.products();
  const pagination = f.facets.loadMore(oldProducts.link);
  const newProducts = f.createProducts(1);
  oldProducts.replaceWith(newProducts);
  f.requests[0].resolve(f.response(2, false));
  await pagination;
  assert.equal(oldProducts.grid.items.length, 1);
  assert.equal(newProducts.grid.items.length, 1);
  assert.equal(newProducts.pagination !== null, true);
  assert.equal(f.navigations.length, 0);
});
