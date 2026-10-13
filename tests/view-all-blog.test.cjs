const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const block = stripShopifyMetadata(fs.readFileSync('blocks/view-all-button.liquid', 'utf8'));
const engine = new Liquid({ templates: { icon: '', ...Object.fromEntries(['view-all-button', 'theme-button', 'section-content-slot'].map((name) => [name, stripShopifyMetadata(fs.readFileSync(`snippets/${name}.liquid`, 'utf8'))])) } });
engine.registerFilter('t', (key) => key);
const render = (closest = {}, settings = {}, designMode = false) => engine.parseAndRenderSync(block, { block: { settings: { button_label: 'View all', ...settings } }, closest, request: { design_mode: designMode } });
const links = (html) => [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((match) => match[1]);

test('both blog sections supply a typed blog context to View all', () => {
  for (const section of ['blog-posts', 'featured-blog-posts']) {
    const source = fs.readFileSync(`sections/${section}.liquid`, 'utf8');
    assert.match(source, /content_for 'block', type: 'view-all-button'[^%]+closest\.blog:/);
    assert.doesNotMatch(source, /content_for 'block', type: 'view-all-button'[^%]+closest\.collection:/);
  }
});

test('resource fallback renders desktop/mobile links when the owning section allows the slot', () => {
  assert.deepEqual(links(render({ blog: { url: '/blogs/news' } })), ['/blogs/news', '/blogs/news']);
  assert.doesNotMatch(render({ blog: { url: '/blogs/news' } }), /data-view-all-button-dynamic/);
});

test('merchant links win; collection fallback keeps its dynamic hook', () => {
  assert.deepEqual(links(render({ blog: { url: '/blogs/news' } }, { button_link: '/pages/manual' })), ['/pages/manual', '/pages/manual']);
  const html = render({ collection: { url: '/collections/all' } });
  assert.deepEqual(links(html), ['/collections/all', '/collections/all']);
  assert.match(html, /data-view-all-button-dynamic/);
});

test('missing resource omits action in storefront and editor preview', () => {
  assert.equal(render().trim(), '');
  assert.deepEqual(links(render({}, {}, true)), []);
  assert.equal(render({}, {}, true).trim(), '');
});

function renderSection(name, source, count, limit, designMode, listSettings = {}) {
  const child = { 'featured-collection': 'product-list', 'blog-posts': 'blog-list', 'featured-blog-posts': 'blog-grid' }[name];
  const resource = source ? { url: '/resource', products_count: count, articles_count: count } : null;
  const settings = child === 'product-list' ? { collection: resource, max_products: limit } : { max_posts: limit };
  const template = stripShopifyMetadata(fs.readFileSync(`sections/${name}.liquid`, 'utf8'))
    .replace(/{% javascript %}[\s\S]*?{% endjavascript %}/g, '')
    .replace(/{% content_for 'block', type: 'view-all-button'[^%]*%}/g, '<a data-test-view-all href="/resource">View all</a>')
    .replace(/{% content_for[^%]*%}/g, '');
  return engine.parseAndRenderSync(template, {
    section: { settings: { blog: resource }, blocks: [{ type: child, settings: { ...settings, ...listSettings } }] },
    request: { design_mode: designMode }
  });
}

test('resource sections require a selected source with strictly more items than actually displayed in every mode', () => {
  for (const section of ['featured-collection', 'blog-posts', 'featured-blog-posts']) {
    const limit = 4;
    const displayed = section === 'featured-blog-posts' ? limit + 1 : limit;
    for (const designMode of [false, true]) {
      for (const selected of [false, true]) {
        for (const count of [0, displayed - 1, displayed, displayed + 1, 100]) {
          const html = renderSection(section, selected, count, limit, designMode);
          assert.equal(html.includes('data-test-view-all'), selected && count > displayed, `${section}, selected=${selected}, count=${count}, editor=${designMode}`);
        }
      }
    }
  }
});

test('resource section limits follow the list defaults and validation rather than loaded array size', () => {
  for (const [section, defaultLimit] of [['featured-collection', 6], ['blog-posts', 4], ['featured-blog-posts', 4]]) {
    for (const limit of [undefined, 0, 99]) {
      assert.equal(renderSection(section, true, defaultLimit, limit, false).includes('data-test-view-all'), false);
      assert.equal(renderSection(section, true, defaultLimit + 1, limit, false).includes('data-test-view-all'), true);
    }
  }
  assert.equal(renderSection('featured-collection', true, 100, 4, false, { use_recommendations: true, products: [{ id: 1 }] }).includes('data-test-view-all'), false);
});

const tabsBlock = stripShopifyMetadata(fs.readFileSync('blocks/tabs-view-all-button.liquid', 'utf8'));
const tabsEngine = new Liquid({ templates: { icon: '', 'size-style': '', ...Object.fromEntries(['view-all-button', 'theme-button', 'section-content-slot'].map((name) => [name, stripShopifyMetadata(fs.readFileSync(`snippets/${name}.liquid`, 'utf8'))])) } });
tabsEngine.registerFilter('t', (key) => key);
function renderTabs(counts, designMode = false, settings = {}) {
  return tabsEngine.parseAndRenderSync(tabsBlock, {
    section: { settings: { max_products: 4 }, blocks: counts.map((count) => ({ type: 'collection-tab', settings: { collection: count === null ? null : { url: `/collections/${count}`, products_count: count } } })) },
    block: { settings }, request: { design_mode: designMode }
  });
}

test('tabs omit the CTA when no collection has overflow, including editor preview', () => {
  for (const designMode of [false, true]) {
    for (const counts of [[], [null], [0], [3], [4], [null, 4]]) assert.equal(renderTabs(counts, designMode).trim(), '');
    assert.deepEqual(links(renderTabs([5], designMode)), ['/collections/5']);
    assert.match(renderTabs([4, 5], designMode), /data-collection-tabs-view-all-wrapper\s+hidden/);
  }
});

test('each tab exposes overflow from the real collection count, independently of loaded products', () => {
  const source = fs.readFileSync('blocks/collection-tab.liquid', 'utf8');
  const flag = source.match(/data-view-all-available="([^\n]+)"/)[0];
  for (const count of [null, 0, 3, 4, 5, 100]) {
    const html = engine.parseAndRenderSync(flag, { collection_tab_collection: count === null ? null : { products_count: count, products: [] }, collection_tab_max_products: 4 });
    assert.equal(html, `data-view-all-available="${count !== null && count > 4}"`);
  }
});

test('switching tabs hides the whole CTA for blank, empty, below and equal counts and restores overflow URL', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync('blocks/tab-layout.liquid', 'utf8');
  const update = source.match(/const updateViewAll = \(state, trigger\) => \{[\s\S]*?\n  \};/)[0];
  const attributes = {};
  const wrapper = { hidden: false };
  const button = { closest: () => wrapper, setAttribute: (key, value) => { attributes[key] = value; }, removeAttribute: (key) => { delete attributes[key]; } };
  const context = { state: { scope: { querySelectorAll: () => [button] } } };
  vm.createContext(context);
  vm.runInContext(`${update};globalThis.update = updateViewAll;`, context);
  for (const available of ['false', undefined, 'true', 'false', 'true']) {
    const trigger = { dataset: { collectionUrl: '/collections/selected', viewAllAvailable: available } };
    context.update(context.state, trigger);
    assert.equal(wrapper.hidden, available !== 'true');
    assert.equal(attributes.href, available === 'true' ? '/collections/selected' : undefined);
  }
  context.update(context.state, null);
  assert.equal(wrapper.hidden, true);
  assert.equal(attributes.href, undefined);
});

test('migration copies legacy static blog resources once and preserves other merchant data', () => {
  const { migrate } = require('../scripts/migrations/blog-section-context.cjs');
  for (const [type, child] of [['blog-posts', 'blog-list'], ['featured-blog-posts', 'blog-grid']]) {
    const document = { sections: { editorial: {
      type, settings: { color_scheme: 'scheme-3' },
      blocks: { source: { type: child, static: true, settings: { blog: 'news', max_posts: 8 } } }
    } } };
    const before = structuredClone(document.sections.editorial.blocks);
    assert.equal(migrate(document), 1);
    assert.equal(document.sections.editorial.settings.blog, 'news');
    assert.deepEqual(document.sections.editorial.blocks, before);
    assert.equal(migrate(document), 0);
    document.sections.editorial.settings.blog = '';
    assert.equal(migrate(document), 0);
    assert.equal(document.sections.editorial.settings.blog, '');
  }
});


test('mobile visibility preference preserves standard resource links and missing-resource behavior', () => {
  for (const hide_view_all_mobile of [false, true]) {
    const html = render({ blog: { url: '/blogs/news' } }, { hide_view_all_mobile });
    assert.deepEqual(links(html), ['/blogs/news', '/blogs/news']);
    assert.equal(html.includes('collection-list-view-all--hide-mobile'), hide_view_all_mobile);
    assert.equal(render({}, { hide_view_all_mobile }).trim(), '');
  }
});

test('mobile visibility preference preserves tab overflow and collection switching hooks', () => {
  for (const hide_view_all_mobile of [false, true]) {
    const html = renderTabs([5], false, { hide_view_all_mobile });
    assert.deepEqual(links(html), ['/collections/5']);
    assert.equal(html.includes('collection-tabs-view-all--hide-mobile'), hide_view_all_mobile);
    assert.match(html, /data-collection-tabs-view-all-wrapper/);
    assert.equal(renderTabs([4], false, { hide_view_all_mobile }).trim(), '');
    assert.match(renderTabs([4, 5], false, { hide_view_all_mobile }), /data-collection-tabs-view-all-wrapper\s+hidden/);
  }
});
