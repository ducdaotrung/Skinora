const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const engine = new (loadLiquid())({
  fs: {
    resolve: (_root, file) => path.join(root, 'snippets', `${file}.liquid`),
    exists: async (file) => fs.existsSync(file),
    readFile: async (file) => stripShopifyMetadata(fs.readFileSync(file, 'utf8'))
  }
});
engine.registerFilter('handleize', (value) => String(value));
engine.registerFilter('color_to_rgb', (value) => value);
const render = (file, settings) => engine.parseAndRender(stripShopifyMetadata(read(file)), {
  block: { id: 'primitive', settings }, section: { id: 'section' }, request: {}
});
const renderVariables = (settings) => engine.parseAndRender(
  read('snippets/css-variables.liquid').replace(/{%\s*style\s*%}|{%\s*endstyle\s*%}/g, ''), { settings }
);

test('Transferred Header, Footer and Blog consumers preserve the responsive Display token', async () => {
  for (const [file, variable] of [
    ['_header-menu', 'menu_font_size'], ['_header-menu', 'submenu_font_size'],
    ['_header-account', 'account_font_size'], ['_header-search', 'search_font_size'],
    ['_header-localization', 'localization_font_size'], ['localization', 'localization_font_size'],
    ['menu', 'menu_size'], ['policy-links', 'policy_links_text_size'],
    ['blog-card-description', 'blog_card_description_size'], ['blog-card-tag', 'blog_card_tag_size']
  ]) {
    const source = read(`blocks/${file}.liquid`);
    assert.ok(source.includes(`unless ${variable} == 'display'`), file);
    assert.doesNotMatch(source, new RegExp(`if ${variable} == 'display'\\s+assign ${variable} = 'md'`), file);
  }
  const menu = await render('blocks/menu.liquid', {
    menu: { title: 'Customer', links: [{ title: 'Contact', url: '/pages/contact' }] },
    heading: 'Customer', menu_size: 'display'
  });
  assert.match(menu, /menu-block__item body-text body-display typography-content/);
  const description = await render('blocks/blog-card-description.liquid', { size: 'display' });
  assert.match(description, /body-text body-display typography-content/);
});

test('Heading Display follows its visual role for every semantic HTML tag', async () => {
  for (const html_tag of ['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    const html = await render('blocks/heading.liquid', { text: '<p>Title</p>', heading_size: 'display', html_tag });
    assert.match(html, new RegExp(`<${html_tag}\\s+class="[^"]*heading-display`));
  }
  const html = await render('blocks/heading.liquid', { text: '<p>Title</p>', heading_size: 'custom', custom_heading_size: 37, html_tag: 'h6' });
  assert.match(html, /<h6\s+class="[^"]*heading-custom/);
  assert.match(html, /--heading-block-custom-size: 37px/);
});

test('Text adds Display and Custom while retaining all saved size options', async () => {
  for (const text_size of ['display', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const html = await render('blocks/text.liquid', { text: '<p><a href="/collections/all">Copy</a></p>', text_size });
    assert.ok(html.includes(`body-${text_size}`), text_size);
    assert.ok(html.includes('typography-content'));
  }
  const defaultHtml = await render('blocks/text.liquid', { text: '<p>Copy</p>' });
  assert.ok(defaultHtml.includes('body-display'));
  for (const [input, expected] of [[37, 37], [10, 10], [100, 100], [101, 16]]) {
    const html = await render('blocks/text.liquid', { text: '<p>Copy</p>', text_size: 'custom', custom_text_size: input });
    assert.match(html, new RegExp(`--text-block-custom-size: ${expected}px`));
  }
});

test('Eyebrow gives its actual text node a theme role and supports custom pixels', async () => {
  const html = await render('blocks/eyebrow.liquid', { text: '<p>Label</p>', eyebrow_size: 'custom', custom_eyebrow_size: 19, show_background: true, color_scheme: { id: 'scheme-2' } });
  assert.match(html, /eyebrow-block--custom/);
  assert.match(html, /--eyebrow-block-custom-size: 19px/);
  assert.match(html, /eyebrow-block__content eyebrow-text typography-content/);
  assert.match(html, /eyebrow-block--background scheme-2/);
});

test('Display tokens emit separate desktop/mobile values with legacy fallback', async () => {
  const css = await renderVariables({ type_body_size: 19, type_body_size_mobile: 15, type_eyebrow_size: 17, type_eyebrow_size_mobile: 11, type_heading_1_size_desktop: 72, type_heading_1_size_mobile: 36 });
  assert.match(css, /--font-body-display: 19px/);
  assert.match(css, /--font-eyebrow-size: 17px/);
  const mobile = css.slice(css.indexOf('@media (max-width: 767.98px)'));
  assert.match(mobile, /--font-body-display: 15px/);
  assert.match(mobile, /--font-eyebrow-size: 11px/);
  assert.match(mobile, /--font-heading-display: 36px/);
  assert.doesNotMatch(mobile.split('{%')[0], /--font-body-md:/);
  const legacy = await renderVariables({ type_body_size: 19, type_eyebrow_size: 17 });
  const legacyMobile = legacy.slice(legacy.indexOf('@media (max-width: 767.98px)'));
  assert.match(legacyMobile, /--font-body-display: 19px/);
  assert.match(legacyMobile, /--font-eyebrow-size: 17px/);
});

test('Active scheme button colors take precedence over legacy global colors', async () => {
  const css = await renderVariables({
    button_primary_background_color: '#FF0000', button_primary_text_color: '#FFFF00',
    button_secondary_background_color: '#FF00FF', button_secondary_text_color: '#00FFFF',
    color_schemes: [{ id: 'scheme-2', settings: {
      button_primary_background: '#123456', button_primary_text: '#ABCDEF',
      button_primary_hover_background: '#654321', button_primary_hover_text: '#FEDCBA',
      button_secondary_background: '#234567', button_secondary_text: '#BCDEFA',
      button_tertiary_text: '#345678', button_tertiary_hover_text: '#CDEFAB'
    } }]
  });
  const scheme = css.slice(css.indexOf('.scheme-2 {'));
  assert.match(scheme, /--button-primary-background: #123456/);
  assert.match(scheme, /--button-primary-text: #ABCDEF/);
  assert.match(scheme, /--button-primary-hover-background: #654321/);
  assert.match(scheme, /--button-secondary-background: #234567/);
  assert.match(scheme, /--button-tertiary-text: #345678/);
  assert.doesNotMatch(css, /\.btn\s*\{/);
  const fallback = await renderVariables({ button_primary_background_color: '#FF0000', button_secondary_text_color: '#00FFFF' });
  assert.match(fallback, /--button-primary-background: #FF0000/);
  assert.match(fallback, /--button-secondary-text: #00FFFF/);
});

test('Every schema range across sections, blocks and global settings has at most 101 values', () => {
  let count = 0;
  function audit(value, file) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'range') {
      count++;
      assert.ok(value.step > 0, `${file}:${value.id} step`);
      assert.ok((value.max - value.min) / value.step <= 100, `${file}:${value.id} values`);
      assert.ok(value.default >= value.min && value.default <= value.max, `${file}:${value.id} default`);
    }
    Object.values(value).forEach((child) => audit(child, file));
  }
  for (const directory of ['blocks', 'sections']) {
    for (const file of fs.readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.liquid'))) {
      const full = `${directory}/${file}`;
      const match = read(full).match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
      if (match) audit(JSON.parse(match[1]), full);
    }
  }
  audit(JSON.parse(read('config/settings_schema.json')), 'config/settings_schema.json');
  assert.ok(count > 1400);
});
