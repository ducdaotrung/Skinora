const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const source = fs.readFileSync(path.join(__dirname, '../blocks/collection-tab.liquid'), 'utf8');
const promo = stripShopifyMetadata(fs.readFileSync(path.join(__dirname, '../snippets/product-list-promo-items.liquid'), 'utf8'));
const capture = source.slice(source.indexOf('{% capture collection_tab_items_content %}'), source.indexOf('{% capture collection_tab_pagination_style %}'));
const renderSource = capture
  .replace(/{% content_for 'block'[\s\S]*?%}/g, '<article>{{ collection_tab_card_product.title }}</article>')
  .replace(/{% render 'product-list-promo-items',([^%]+)%}/g, (_, args) => {
    const variables = [...args.matchAll(/(\w+):\s*([\w.]+)/g)].map(([, key, value]) => `{% assign ${key} = ${value} %}`).join('');
    return variables + promo;
  }) + '{{ collection_tab_items_content }}';
const engine = new Liquid();

test('collection tabs render their own promo between products in grid and carousel', async () => {
  for (const layout of ['grid', 'carousel']) {
    const output = await engine.parseAndRender(renderSource, {
      collection_tab_items: [{title:'first product'}, {title:'second product'}],
      collection_tab_item_limit: 2, collection_tab_last_position: 3, collection_tab_layout: layout,
      collection_tab_promo_cards: '<!--promo-card-slot:2--><div data-promo-card>tab offer</div><!--/promo-card-slot-->'
    });
    assert.ok(output.indexOf('first product') < output.indexOf('tab offer'));
    assert.ok(output.indexOf('tab offer') < output.indexOf('second product'));
    assert.equal((output.match(/data-product-list-promo-item/g)||[]).length,1);
    assert.equal((output.match(/class="swiper-slide /g)||[]).length,layout==='carousel'?3:0);
  }
});
test('another tab without promos keeps its product list unchanged', async () => {
  const output = await engine.parseAndRender(renderSource, {
    collection_tab_items:[{title:'other tab product'}], collection_tab_item_limit:1,
    collection_tab_last_position:2, collection_tab_layout:'grid', collection_tab_promo_cards:''
  });
  assert.match(output,/other tab product/);
  assert.doesNotMatch(output,/data-promo-card|data-product-list-promo-item/);
});
