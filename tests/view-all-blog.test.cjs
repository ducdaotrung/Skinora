const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const block = stripShopifyMetadata(fs.readFileSync('blocks/view-all-button.liquid', 'utf8'));
const engine = new Liquid({ templates: { icon: '', ...Object.fromEntries(['view-all-button', 'theme-button'].map((name) => [name, stripShopifyMetadata(fs.readFileSync(`snippets/${name}.liquid`, 'utf8'))])) } });
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

test('blank manual link renders desktop/mobile href from selected News blog, including empty articles', () => {
  for (const articles of [[], [{ title: 'Article' }]]) {
    const html = render({ blog: { url: '/blogs/news', articles } });
    assert.deepEqual(links(html), ['/blogs/news', '/blogs/news']);
    assert.doesNotMatch(html, /data-view-all-button-dynamic/);
  }
  assert.deepEqual(links(render({ blog: { url: '/blogs/updates' } })), ['/blogs/updates', '/blogs/updates']);
});

test('merchant links win; collection fallback keeps its dynamic hook', () => {
  assert.deepEqual(links(render({ blog: { url: '/blogs/news' } }, { button_link: '/pages/manual' })), ['/pages/manual', '/pages/manual']);
  const html = render({ collection: { url: '/collections/all' } });
  assert.deepEqual(links(html), ['/collections/all', '/collections/all']);
  assert.match(html, /data-view-all-button-dynamic/);
});

test('missing resource omits storefront action and retains editor placeholder', () => {
  assert.equal(render().trim(), '');
  assert.deepEqual(links(render({}, {}, true)), []);
  assert.match(render({}, {}, true), /<button/);
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
