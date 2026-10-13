const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
// Exercise the row's Liquid rendering with the nested HTML supplied by
// Shopify content_for. The shared disclosure has its own behavior tests.
const source = stripShopifyMetadata(fs.readFileSync(path.join(__dirname, '../blocks/faq_item.liquid'), 'utf8'))
  .replace(/{%\s*content_for 'blocks'\s*%}/g, '{{ nested_answer }}')
  .replace(/{%\s*render 'icon',[\s\S]*?%}/g, '')
  .replace(/{%\s*render 'accordion-details',[\s\S]*?%}/g, '<details>{{ faq_summary }}{{ faq_answer }}</details>');
const engine = new Liquid();
const render = (settings, children = [], nested = '', editor = false) => engine.parseAndRender(source, {
  block: { id: 'row', settings, blocks: children },
  nested_answer: nested, request: { design_mode: editor }
});

test('rendered nested answer keeps the storefront row even when child settings are opaque', async () => {
  const html = await render({ question: 'Materials?' }, [{ id: 'answer' }], '<p>Gold.</p>');
  assert.match(html, /<details>[\s\S]*Materials\?[\s\S]*<p>Gold\.<\/p>/);
});

test('legacy inline answer remains supported', async () => {
  assert.match(await render({ question: 'Shipping?', answer: '<p>Three days.</p>' }), /<details>[\s\S]*Three days/);
});

test('missing and empty answers retain storefront questions with editor-only placeholders', async () => {
  const empty = await render({ question: 'Empty?' });
  assert.match(empty, /<details>[\s\S]*Empty\?/);
  assert.doesNotMatch(empty, /Share the answer/);
  assert.match(await render({ question: 'Empty?' }, [{ id: 'answer' }], '  \n  '), /<details>/);
  assert.match(await render({ question: 'Empty?' }, [], '', true), /<details>[\s\S]*Share the answer/);
  assert.match(await render({ question: 'Empty?' }, [{ id: 'answer' }], '', true), /<details>/);
});
