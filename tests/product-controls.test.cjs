const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');

const snippetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'product-controls-'));
for (const name of fs.readdirSync('snippets').filter((name) => name.endsWith('.liquid'))) {
  fs.writeFileSync(path.join(snippetRoot, name), stripShopifyMetadata(fs.readFileSync(path.join('snippets', name), 'utf8')));
}
after(() => fs.rmSync(snippetRoot, { recursive: true, force: true }));
const engine = new (loadLiquid())({ root: snippetRoot, extname: '.liquid' });
engine.registerFilter('t', (value) => value);
engine.registerFilter('json', JSON.stringify);
engine.registerFilter('handleize', (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('image_url', (value) => value?.id ? `/image-${value.id}.png` : '');
engine.registerFilter('image_tag', (value) => value ? `<img class="swatch__image" src="${value}" alt="">` : '');
const picker = stripShopifyMetadata(fs.readFileSync('snippets/variant-picker.liquid', 'utf8'));
const swatch = stripShopifyMetadata(fs.readFileSync('snippets/swatch.liquid', 'utf8'));
const quantity = stripShopifyMetadata(fs.readFileSync('blocks/product-buy-quantity.liquid', 'utf8'));
const optionValue = (name, swatch, selected = false) => ({ name, swatch, selected, available: true });
const renderPicker = (options, extras = {}) => engine.parseAndRender(picker, {
  product: { id: 1, options_with_values: options, variants: [] },
  current_variant: { id: 1, available: true },
  settings: { variant_picker_style: 'button' },
  ...extras,
});

test('native RGB swatches take precedence over fallback names and HEX strings remain supported', async () => {
  for (const [color, expected] of [[{ rgb: '12, 34, 56' }, 'rgb(12, 34, 56)'], ['#123456', '#123456'], ['rgb(45, 67, 89)', 'rgb(45, 67, 89)']]) {
    const html = await engine.parseAndRender(swatch, { value: 'Red', swatch: { color }, style: 'color' });
    assert.ok(html.includes(`background-color: ${expected};`));
    assert.ok(!html.includes('#b42318'));
  }
});

test('partially configured and translated color options retain swatches with fallback for missing values', async () => {
  const html = await renderPicker([{ name: 'Màu sắc', values: [optionValue('Custom', { color: { rgb: '1, 2, 3' } }, true), optionValue('Navy')] }]);
  assert.match(html, /swatch-control--underline/);
  assert.equal((html.match(/class="swatch swatch--color/g) || []).length, 2);
  assert.ok(html.includes('background-color: rgb(1, 2, 3);'));
  assert.ok(html.includes('background-color: #1c4d8c;'));
  const legacy = await renderPicker([{ name: 'Color', values: [optionValue('Red', { color: { rgb: '1, 2, 3' } })] }], { color_option_display: 'text' });
  assert.match(legacy, /class="swatch swatch--color/);
});

test('picker and product card use the same native swatch colors, including image-only swatch values', async () => {
  const cardSource = stripShopifyMetadata(fs.readFileSync('snippets/product-card-swatches.liquid', 'utf8'));
  for (const option of [
    { name: 'Màu sắc', position: 1, values: [optionValue('Custom', { color: { rgb: '12, 34, 56' } })] },
    { name: 'Pattern', position: 1, values: [optionValue('Black', { image: { id: 99 } })] },
  ]) {
    option.values.forEach((value) => { value.product_url = '/products/example'; });
    const card = await engine.parseAndRender(cardSource, { product: { id: 1, url: '/products/example', options_with_values: [option] }, settings: {} });
    const pickerHtml = await renderPicker([option]);
    const color = (html) => { const match = html.match(/background-color: ([^;]+);/); assert.ok(match, option.name + ': ' + html); return match[1]; };
    assert.equal(color(pickerHtml), color(card));
    assert.match(pickerHtml, /variant-picker__option--swatches/);
  }
});

test('caption and size guide share a header while the fieldset keeps its accessible legend', async () => {
  const options = [{ name: 'Size', values: [optionValue('Small', undefined, true)] }];
  const extras = { size_chart_page: { title: 'Size guide', content: '<p>Guide</p>' } };
  const html = await renderPicker(options, extras);
  assert.match(html, /<legend[^>]*class="visually-hidden">\s*Size\s*<\/legend>/);
  assert.match(html, /variant-picker__option-header[\s\S]*variant-picker__label body-sm[\s\S]*variant-picker__size-chart-trigger[\s\S]*<\/button>\s*<\/div>/);
  const hidden = await renderPicker(options, { ...extras, show_option_names: false });
  assert.match(hidden, /data-show-option-captions="false"/);
  assert.doesNotMatch(hidden, /variant-picker__label body-sm/);
  assert.match(hidden, /data-size-chart-trigger/);
  const noGuide = await renderPicker(options, { show_option_names: false });
  assert.doesNotMatch(noGuide, /variant-picker__option-header/);
});

test('color presentation follows Swatches settings independently of the normal picker style', async () => {
  const options = [{ name: 'Color', values: [optionValue('Red', { color: { rgb: '1, 2, 3' }, image: { id: 99 } }, true)] }, { name: 'Size', values: [optionValue('Small', undefined, true)] }];
  const render = (style) => renderPicker(options, { settings: { variant_picker_style: 'dropdown', swatch_style: style, swatch_selected_style: 'underline' }, form_id: 'ExampleForm' });
  const color = await render('color');
  assert.match(color, /swatch-control--underline/);
  assert.match(color, /<label class="swatch-control[^>]*>\s*<input[\s\S]*?form="ExampleForm"[\s\S]*?data-option-control/);
  assert.equal((color.match(/<select/g) || []).length, 1);
  assert.doesNotMatch(color, /swatch__image/);
  const image = await render('variant_image');
  assert.match(image, /src="\/image-99.png"/);
  assert.doesNotMatch(image, /--swatch-height-ratio:/);
  const cardRatio = await renderPicker(options, { settings: { swatch_style: 'variant_image' }, swatch_height_ratio_override: '3 / 2' });
  assert.match(cardRatio, /--swatch-height-ratio: 3 \/ 2;/);
  const button = await render('button');
  assert.doesNotMatch(button, /swatch-control|variant-picker__option--swatches/);
  assert.match(button, /variant-picker__button/);
  assert.equal((button.match(/<select/g) || []).length, 1);
  const dropdown = await render('dropdown');
  assert.equal((dropdown.match(/<select/g) || []).length, 2);
  assert.doesNotMatch(dropdown, /swatch-control/);
});

test('quantity renders escaped custom labels and hides blank labels with an accessible fallback', async () => {
  const render = (label) => engine.parseAndRender(quantity, { block: { settings: { label } }, form_id: 'ProductForm', quantity_min: 1, quantity_step: 1 });
  assert.match(await render('Amount & count'), /class="form__label" for="ProductForm-quantity">Amount &amp; count<\/label>/);
  for (const label of ['', '   ', undefined]) {
    assert.match(await render(label), /class="form__label visually-hidden" for="ProductForm-quantity">accessibility.quantity<\/label>/);
  }
});

test('global swatch image ratio ignores the color ratio while Color keeps it', async () => {
  const variables = fs.readFileSync('snippets/css-variables.liquid', 'utf8');
  const start = variables.indexOf("  assign swatch_style = 'color'");
  const end = variables.indexOf('  assign badge_radius', start);
  const source = '{% liquid\n' + variables.slice(start, end) + '%}{{ swatch_height_ratio }}';
  assert.equal(await engine.parseAndRender(source, { settings: { swatch_style: 'variant_image', swatch_height_ratio: '3_1' } }), '1 / 1');
  assert.equal(await engine.parseAndRender(source, { settings: { swatch_style: 'color', swatch_height_ratio: '3_2' } }), '3 / 2');
});
