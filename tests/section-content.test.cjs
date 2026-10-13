const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');

const Liquid = loadLiquid();
const engine = new Liquid({ strictFilters: false, fs: {
  resolve: (_root, file) => path.resolve('snippets', file + '.liquid'),
  existsSync: fs.existsSync,
  readFileSync: (file) => stripShopifyMetadata(fs.readFileSync(file, 'utf8'))
} });
engine.registerFilter('placeholder_svg_tag', () => '<svg></svg>');
engine.registerFilter('t', (value) => value);
engine.registerFilter('handleize', (value) => String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '-'));

function source(file) {
  return stripShopifyMetadata(fs.readFileSync(file, 'utf8'))
    .replace(/{%\s*(javascript|style)\s*%}[\s\S]*?{%\s*end\1\s*%}/g, '')
    .replace(/{% content_for 'block', type: '([^']+)'[^%]*%}/g, (_, type) => `{{ slots['${type}'] }}`)
    .replace(/{% content_for 'blocks' %}/g, '{{ children }}');
}

function render(file, context = {}) {
  return engine.parseAndRenderSync(source(file), {
    section: { settings: {}, blocks: [] }, block: { settings: {}, shopify_attributes: 'data-editor-block="a"' },
    request: { design_mode: true }, slots: {}, children: '', ...context
  });
}

test('slot omits whitespace output and preserves markup, classes, and trusted instance hooks', () => {
  const file = 'snippets/section-content-slot.liquid';
  assert.equal(render(file, { content: ' \n ' }).trim(), '');
  const html = render(file, { content: '<a href="/collections/all">View all</a>', class: 'actions', attributes: 'data-actions' });
  assert.match(html, /class="section-content-slot actions" data-actions/);
  assert.match(html, /href="\/collections\/all"/);
});

test('rich text kernels mark empty HTML and retain editor metadata', () => {
  for (const type of ['heading', 'text', 'eyebrow']) {
    for (const text of ['', '   ', '<p></p>', '<p><br></p>', '<p>&nbsp;</p>', '<p>&#160;</p>']) {
      const html = render(`blocks/${type}.liquid`, { block: { settings: { text }, shopify_attributes: 'data-editor-block="a"' } });
      assert.match(html, /data-content-empty/, `${type}: ${text}`);
      assert.match(html, /data-editor-block="a"/);
    }
    const html = render(`blocks/${type}.liquid`, { block: { settings: { text: '<p>Collection</p>' } } });
    assert.doesNotMatch(html, /data-content-empty/);
  }
});

test('compound Header becomes empty only when every child is empty', () => {
  const emptyChild = '<div class="heading-block" data-content-empty data-editor-block="a"><p>&nbsp;</p></div>';
  assert.match(render('blocks/header.liquid', { children: emptyChild }), /data-content-empty\s+data-editor-block="a"/);
  const html = render('blocks/header.liquid', { children: `${emptyChild}<h2><p>Title</p></h2>` });
  assert.doesNotMatch(html.match(/<div[^>]*class="block-header[\s\S]*?>/)[0], /data-content-empty/);
  assert.match(html, /<h2><p>Title<\/p><\/h2>/);
});

test('empty collapsed text does not create a Read more control or make its Header nonempty', () => {
  const html = render('blocks/text.liquid', { block: { settings: { text: '<p>&nbsp;</p>', height_limit: 'small' } } });
  assert.match(html, /data-content-empty/);
  assert.doesNotMatch(html, /text-block__collapse-toggle|product-description/);
  const header = render('blocks/header.liquid', { children: html });
  assert.match(header.match(/<div[^>]*class="block-header[\s\S]*?>/)[0], /data-content-empty/);
});

test('Blog Grid collapses without articles on storefront but retains editor placeholders', () => {
  const file = 'blocks/blog-grid.liquid';
  for (const blog of [null, { articles: [] }]) {
    const context = { closest: { blog }, request: { design_mode: false } };
    assert.match(render(file, context), /data-content-empty/);
    assert.doesNotMatch(render(file, { ...context, request: { design_mode: true }, slots: { 'first-card': '<article>Placeholder</article>', 'blog-card': '<article>Placeholder</article>' } }), /data-content-empty/);
  }
  assert.doesNotMatch(render(file, { closest: { blog: { articles: [{ title: 'News' }] } }, slots: { 'first-card': '<article>News</article>' } }), /data-content-empty/);
  assert.match(render(file, { closest: { blog: { articles: [{ title: 'News' }] } } }), /data-content-empty/);
});

test('Blog Grid omits hidden First card and supporting-card wrappers', () => {
  const blog = { articles: [{ title: 'Lead' }, { title: 'Second' }] };
  const firstHidden = render('blocks/blog-grid.liquid', { closest: { blog }, slots: { 'first-card': ' ', 'blog-card': '<article>Second</article>' } });
  assert.doesNotMatch(firstHidden, /class="section-content-slot blog-grid__first-card"/);
  assert.match(firstHidden, /class="section-content-slot blog-grid__items"/);
  assert.doesNotMatch(firstHidden, /data-content-empty/);
  const secondaryHidden = render('blocks/blog-grid.liquid', { closest: { blog }, slots: { 'first-card': '<article>Lead</article>', 'blog-card': '' } });
  assert.doesNotMatch(secondaryHidden, /class="section-content-slot blog-grid__items"/);
  assert.match(secondaryHidden, /class="section-content-slot blog-grid__first-card"/);
  assert.match(render('blocks/blog-grid.liquid', { closest: { blog }, slots: {} }), /data-content-empty/);
});

test('list sections omit absent slots and keep existing classes and resource hooks', () => {
  for (const type of ['featured-collection', 'collection-list', 'blog-posts', 'featured-blog-posts']) {
    const html = render(`sections/${type}.liquid`, { slots: { header: ' \n ', 'view-all-button': '', 'product-list': '', 'collection-list-items': '', 'blog-list': '', 'blog-grid': '' } });
    assert.doesNotMatch(html, /class="section-content-slot/);
    assert.match(html, /section-content-surface/);
    assert.match(html, /section-list-layout/);
    const resource = { url: '/news', articles_count: 100, products_count: 100 };
    const child = { 'featured-collection': 'product-list', 'blog-posts': 'blog-list', 'featured-blog-posts': 'blog-grid' }[type];
    const filled = render(`sections/${type}.liquid`, { section: { settings: { blog: resource }, blocks: [{ type: child, settings: { collection: resource } }] }, slots: { header: '<div class="block-header"><h2>Title</h2></div>', 'view-all-button': '<a href="/news">View all</a>' } });
    assert.match(filled, new RegExp(`${type}__header section-list-layout__header`));
    assert.match(filled, new RegExp(`${type}__actions section-list-layout__actions`));
    if (type === 'featured-collection') assert.match(filled, /data-featured-collection-actions/);
  }
});

test('dynamic Hotspot wrapper classes are evaluated before slot rendering', () => {
  const slots = { header: '<div class="block-header"><h2>Title</h2></div>' };
  const gallery = render('sections/hotspot-gallery.liquid', { section: { settings: { header_vertical_alignment: 'bottom', enable_header_sticky: true }, blocks: [] }, slots });
  assert.match(gallery, /hotspot-gallery__header--bottom/);
  assert.match(gallery, /hotspot-gallery__header--sticky/);
  assert.doesNotMatch(gallery, /class="[^"]*\{%/);
  const hotspot = render('sections/hotspot.liquid', { slots });
  assert.match(hotspot, /hotspot-section__header container full-width/);
});
