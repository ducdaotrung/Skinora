const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({ strictFilters: false });
engine.registerFilter('t', value => value);
engine.registerTag('content_for', { parse() {}, render(ctx) { const product = ctx.get(['product_list_card_product']); return `<article data-id="${product?.id || 'placeholder'}"></article>`; } });
engine.registerTag('render', { parse(token) { this.grid = token.args.includes('product-collection-grid'); }, render(ctx) { return this.grid ? ctx.get(['product_list_items_content']) : ''; } });
const source = stripShopifyMetadata(fs.readFileSync('blocks/product-list.liquid', 'utf8'));
const render = (settings, recommended) => engine.parseAndRenderSync(source, { block: {id:'recs',settings:{layout_type:'carousel',max_products:8,...settings}}, recommendation_products:recommended });
const ids = html => [...html.matchAll(/data-id="(.*?)"/g)].map(match=>match[1]);
test('recommendation source preserves native product order instead of collection resources', () => {
 assert.deepEqual(ids(render({use_recommendations:true,collection:{products:[{id:1}]}},[{id:9},{id:3}])),['9','3']);
});
test('empty recommendations use merchant fallback products and request remains capped at Shopify maximum', () => {
 const html=render({use_recommendations:true,products:[{id:8},{id:4}],max_products:24},[]);
 assert.deepEqual(ids(html),['8','4']); assert.match(html,/data-recommendation-limit="10"/); assert.match(html,/data-recommendation-placeholder="false"/);
});
test('default collection callers retain their original source despite an unrelated recommendations context', () => {
 assert.deepEqual(ids(render({collection:{products:[{id:7},{id:2}]}},[{id:9}])),['7','2']);
});
test('missing resources retain a deliberate editor skeleton rather than real product links', () => {
 const html=render({use_recommendations:true},[]);
 assert.equal(ids(html).length,8); assert.ok(ids(html).every(id=>id==='placeholder')); assert.match(html,/data-recommendation-placeholder="true"/);
});
test('shared grid treats explicit recommended resources as real content, not placeholder collection metadata', () => {
 const grid=stripShopifyMetadata(fs.readFileSync('snippets/product-collection-grid.liquid','utf8'));
 const html=engine.parseAndRenderSync(grid,{products:[{id:8},{id:4}],items_content:'<article data-real-card></article>',layout_type:'grid',show_placeholders:true,placeholder_count:8});
 assert.doesNotMatch(html,/product-collection-grid--placeholder/);
 assert.match(html,/data-real-card/);
});
