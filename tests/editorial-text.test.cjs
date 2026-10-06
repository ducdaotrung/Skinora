const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const source = stripShopifyMetadata(fs.readFileSync(path.join(__dirname, '../blocks/editorial-text.liquid'), 'utf8'))
  .replace(/{%\s*render 'size-style',[\s\S]*?%}/g, '');
const engine = new Liquid();
engine.registerFilter('image_url', image => '/images/' + image.filename);
engine.registerFilter('image_tag', url => '<img src="' + url + '">');
engine.registerFilter('placeholder_svg_tag', (name, className) => '<svg class="' + className + '"></svg>');
engine.registerFilter('asset_url', name => '/assets/' + name);
const render = (settings, editor = false) => engine.parseAndRender(source, {
  block: { settings }, request: { design_mode: editor }
});

test('all five markers use their corresponding selected image and preserve repeated markers', async () => {
  const settings = { text: '<p>[img5] [img1] [img2] [img3] [img4] [img5]</p>', corner_radius: 'rounded' };
  for (let i = 1; i <= 5; i++) {
    settings['show_image_' + i] = true;
    settings['image_' + i] = { filename: i + '.jpg', alt: 'Image ' + i };
  }
  const html = await render(settings);
  assert.doesNotMatch(html, /\[img\d\]/);
  assert.equal((html.match(/<img /g) || []).length, 6);
  assert.match(html, /\/images\/5.jpg[\s\S]*\/images\/1.jpg/);
  assert.match(html, /--editorial-image-radius: var\(--radius-rounded\)/);
});

test('disabled and missing image slots disappear on storefront; editor uses shared placeholders', async () => {
  const settings = { text: '<p>Before [img1] [img2] after</p>', show_image_1: true, show_image_2: false };
  const storefront = await render(settings);
  assert.doesNotMatch(storefront, /\[img\d\]|placeholder-image/);
  const editor = await render(settings, true);
  assert.equal((editor.match(/class="image placeholder-image"/g) || []).length, 1);
  assert.match(editor, /class="image__placeholder"/);
});

test('image links escape query strings, protect new tabs, and use independent responsive sizes', async () => {
  const html = await render({ text: '<p>[img5]</p>', show_image_5: true,
    image_5: { filename: 'five.jpg', alt: 'Five' }, image_link_5: '/collections/all?a=1&b=2',
    image_new_tab_5: true, image_width_5: 300, image_width_mobile_5: 120,
    corner_radius: 'custom', custom_corner_radius: 80 });
  assert.match(html, /href="\/collections\/all\?a=1&amp;b=2"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /--editorial-image-width: 300px; --editorial-image-width-mobile: 120px/);
  assert.match(html, /--editorial-image-radius: 40px/);
});
