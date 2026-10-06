const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({ strictFilters: false });
engine.registerFilter('t', key => key);
engine.registerTag('render', { parse() {}, render() { return '<span data-native-links></span>'; } });
engine.registerTag('content_for', {
  parse(token) { this.args = token.args; },
  render(ctx) {
    if (this.args.includes("type: '_collections-page-card'")) return ctx.get(['hide_card']) ? '' : `<article data-card="${ctx.get(['collection_item', 'id'])}" data-loading="${ctx.get(['card_loading'])}"></article>`;
    if (this.args.includes("type: 'pagination'")) return `<nav data-pages="${ctx.get(['paginate', 'pages'])}"></nav>`;
    return '';
  }
});
const source = stripShopifyMetadata(fs.readFileSync('blocks/_collections-list.liquid', 'utf8')).replace(/{%\s*(?:paginate[^%]*|endpaginate)\s*%}/g, '');
const render = (collections, custom, extra = {}) => engine.parseAndRenderSync(source, { collections, block: { settings: { custom_collections: custom, columns_desktop: '3', columns_mobile: '2', column_gap_desktop: 12, column_gap_mobile: 8 } }, section: { settings: { section_width: 'page_width' } }, settings: {}, paginate: { pages: 2 }, ...extra });
const ids = html => [...html.matchAll(/data-card="(\d+)"/g)].map(x => +x[1]);
const items = first => Array.from({ length: 8 }, (_, i) => ({ id: first + i }));
test('blank picker preserves each resource from the native paginated all-collections source', () => {
 const html = render(items(1), []);
 assert.deepEqual(ids(html), [1,2,3,4,5,6,7,8]);
 assert.equal((html.match(/data-loading="eager"/g) || []).length, 3);
 assert.equal((html.match(/data-loading="lazy"/g) || []).length, 5);
 assert.match(html, /data-pages="2"/);
});
test('custom picker preserves merchant order and ignores all-collections source', () => {
 assert.deepEqual(ids(render(items(1), [{id: 23},{id: 7},{id: 10}])), [23,7,10]);
});
test('page-two native resources do not repeat page-one resources', () => {
 assert.deepEqual(ids(render(items(9), null)), [9,10,11,12,13,14,15,16]);
});
test('empty source has a translatable status and no invented card links', () => {
 const html = render([], []);
 assert.deepEqual(ids(html), []);
 assert.match(html, /role="status">collections.empty/);
});
test('hiding fixed card slot keeps pagination reachable', () => {
 const html = render(items(1), [], {hide_card:true});
 assert.deepEqual(ids(html), []);
 assert.match(html, /data-pages="2"/);
});
test('static slots absent from order and shared sizing stays canonical', () => {
 const template = JSON.parse(fs.readFileSync('templates/list-collections.json','utf8'));
 const main = template.sections.main;
 assert.deepEqual(main.block_order, ['heading-0']);
 assert.equal(main.blocks['collection-list'].static,true);
 assert.equal(main.blocks['collection-list'].blocks['pagination'].static,true);
 assert.equal(main.blocks['collection-list'].blocks['collection-card'].blocks['collection-card-title-0'].settings.heading_size,'md');
 const pagination = fs.readFileSync('blocks/pagination.liquid','utf8');
 assert.match(pagination,/list_paginate \| default: blog_paginate/);
});

test('materialized native links never evaluate a lazy setting-array paginate drop in the child block', () => {
 const adapter = stripShopifyMetadata(fs.readFileSync('blocks/pagination.liquid','utf8'));
 const lazyPaginate = {};
 Object.defineProperty(lazyPaginate, 'pages', { get() { throw new Error('Query owner was replaced by child block'); } });
 const html = engine.parseAndRenderSync(adapter, { list_paginate: lazyPaginate, native_page_count: 2, native_page_links: '<a href="/collections?page_custom=2">2</a>', block: {settings:{style:'outline',height:'large'}}, request:{design_mode:false} });
 assert.match(html, /data-style="outline" data-height="large"/);
 assert.match(html, /href="\/collections\?page_custom=2"/);
});

test('shared card kernel preserves legacy ratios and exposes truthful new ratios', () => {
 const kernel = stripShopifyMetadata(fs.readFileSync('snippets/collection-card-render.liquid','utf8'));
 engine.registerFilter('placeholder_svg_tag', name => `<svg data-placeholder="${name}"></svg>`);
 for (const [ratio, expected] of [['landscape','1.3333'],['portrait','0.8'],['landscape_3_2','1.5'],['portrait_2_3','0.6667']]) {
  const html = engine.parseAndRenderSync(kernel, { block:{settings:{ratio,color_type:'inherit'},shopify_attributes:'data-owner="card"'}, card_collection:{title:'Aurelia',url:'/collections/aurelia'}, card_content:'<h2>Aurelia</h2>', request:{design_mode:false}, placeholder_index:2 });
  assert.match(html, new RegExp(`--collection-card-ratio:${expected.replace('.', '\\.')};`));
  assert.match(html, /href="\/collections\/aurelia"/);
  assert.equal((html.match(/data-owner="card"/g)||[]).length,1);
  assert.equal((html.match(/<h2>Aurelia<\/h2>/g)||[]).length,1);
  assert.match(html, /data-placeholder="collection-2"/);
 }
});
