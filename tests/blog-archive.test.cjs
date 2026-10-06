const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({ strictFilters: false });
engine.registerFilter('t', (key) => key);
engine.registerFilter('handleize', (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerTag('content_for', {
  parse(token) { this.args = token.args; },
  render(ctx) {
    if (this.args.includes("type: 'featured-post'")) {
      const articles = ctx.get(['blog', 'articles']);
      return ctx.get(['show_featured']) && articles.length ? `<article data-featured="${articles[0].id}"></article>` : '';
    }
    if (this.args.includes("type: 'blog-card'")) return `<article data-card="${ctx.get(['blog_archive_article', 'id'])}"></article>`;
    return '';
  }
});
const archive = stripShopifyMetadata(fs.readFileSync('blocks/blog-archive-list.liquid', 'utf8')).replace(/{%\s*(?:paginate[^%]*|endpaginate)\s*%}/g, '');
const filters = stripShopifyMetadata(fs.readFileSync('blocks/blog-tag-filter.liquid', 'utf8'));
const ids = (html, kind) => [...html.matchAll(new RegExp(`data-${kind}="(\\d+)"`, 'g'))].map((m) => Number(m[1]));
const render = (articles, showFeatured) => engine.parseAndRenderSync(archive, { blog: { articles }, section: { settings: { posts_per_page: 7 } }, block: { settings: { columns: '3' } }, show_featured: showFeatured, request: { design_mode: false } });
const articles = (first) => Array.from({ length: 7 }, (_, i) => ({ id: first + i }));

test('visible featured article consumes exactly one item from the paginated page', () => {
  const html = render(articles(1), true);
  assert.deepEqual(ids(html, 'featured'), [1]);
  assert.deepEqual(ids(html, 'card'), [2, 3, 4, 5, 6, 7]);
});
test('hiding featured preserves every article, including the first', () => {
  const html = render(articles(1), false);
  assert.deepEqual(ids(html, 'featured'), []);
  assert.deepEqual(ids(html, 'card'), [1, 2, 3, 4, 5, 6, 7]);
});
test('subsequent page uses its own first article once instead of repeating page one', () => {
  const html = render(articles(8), true);
  assert.deepEqual([...ids(html, 'featured'), ...ids(html, 'card')], [8, 9, 10, 11, 12, 13, 14]);
});
test('empty blog has no misleading storefront cards', () => {
  assert.deepEqual(ids(render([], true), 'card'), []);
  assert.deepEqual(ids(render([], true), 'featured'), []);
});
test('tag limit includes All posts, keeps an out-of-range selected tag visible and resets page', () => {
  const html = engine.parseAndRenderSync(filters, { blog: { url: '/blogs/news', all_tags: ['CARE', 'GEMSTONES', 'GIFT GUIDE', 'GUIDE', 'NEWS'] }, current_tags: ['NEWS'], block: { settings: { tag_limit: 5, style: 'underline' } } });
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links.length, 5);
  assert.ok(links.includes('/blogs/news/tagged/news'));
  assert.ok(links.every((url) => !url.includes('?page=')));
  assert.match(html, /href="\/blogs\/news\/tagged\/news" aria-current="page"/);
});

test('shared collection page markup preserves numeric current pages and native URLs', () => {
  const pagination = stripShopifyMetadata(fs.readFileSync('snippets/pagination-pages.liquid', 'utf8'));
  const html = engine.parseAndRenderSync(pagination, {
    paginate: { pages: 2, current_page: 1, parts: [{ title: 1, is_link: false }, { title: 2, is_link: true, url: '/blogs/news?page=2' }] }
  });
  assert.match(html, /class="page current" aria-current="page">1<\/span>/);
  assert.match(html, /href="\/blogs\/news\?page=2">2<\/a>/);
  for (const path of ['blocks/pagination.liquid', 'blocks/_collection-pagination.liquid']) {
    assert.match(fs.readFileSync(path, 'utf8'), /render 'pagination-pages'/);
    assert.match(fs.readFileSync(path, 'utf8'), /component-pagination\.css/);
  }
});

test('blog adapter maps legacy text and hyphenated heights to the collection contract', () => {
  const pages = stripShopifyMetadata(fs.readFileSync('snippets/pagination-pages.liquid', 'utf8'));
  const adapter = stripShopifyMetadata(fs.readFileSync('blocks/pagination.liquid', 'utf8'))
    .replace("{% render 'pagination-pages', paginate: pagination_data %}", '{% assign paginate = pagination_data %}' + pages);
  const html = engine.parseAndRenderSync(adapter, {
    blog_paginate: { pages: 2, current_page: 1, parts: [{ title: 1, is_link: false }] },
    block: { settings: { style: 'text', height: 'extra-small', padding_top: 12, customize_mobile_padding: true, padding_top_mobile: 4 } },
    request: { design_mode: false }
  });
  assert.match(html, /data-style="tertiary" data-height="extra_small"/);
  assert.match(html, /--pagination-padding-top: 12px/);
  assert.match(html, /--pagination-padding-top-mobile: 4px/);
  assert.match(html, /class="page current" aria-current="page">1<\/span>/);
});
