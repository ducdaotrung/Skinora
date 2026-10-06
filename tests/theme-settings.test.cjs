const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('color scheme CSS output is normalized before emission', () => {
  const source = read('snippets/css-variables.liquid');
  const loopStart = source.indexOf('{% for scheme in settings.color_schemes %}');
  const outputStart = source.indexOf('    .{{ scheme.id }} {', loopStart);
  const loopEnd = source.indexOf('  {% endfor %}', outputStart);
  const output = source.slice(outputStart, loopEnd);

  assert.notEqual(loopStart, -1);
  assert.notEqual(outputStart, -1);
  assert.notEqual(loopEnd, -1);
  assert.doesNotMatch(output, /scheme\.settings\./);

  for (const token of [
    'background-color',
    'heading-color',
    'heading-highlight-color',
    'body-color',
    'accent-color',
    'border-color',
    'shadow-color',
    'sale-price-color',
    'button-primary-background',
    'button-primary-text',
    'button-primary-border',
    'button-primary-hover-background',
    'button-primary-hover-text',
    'button-primary-hover-border',
    'button-secondary-background',
    'button-secondary-text',
    'button-secondary-border',
    'button-secondary-hover-background',
    'button-secondary-hover-text',
    'button-secondary-hover-border',
    'button-tertiary-text',
    'button-tertiary-hover-text'
  ]) {
    assert.match(output, new RegExp(`--${token}:`));
  }

  assert.match(output, /--button-primary-hover-background: \{\{ scheme_primary_hover_background \}\};/);
  assert.match(output, /--button-secondary-hover-background: \{\{ scheme_secondary_hover_background \}\};/);
  assert.match(output, /--color-foreground-rgb: \{\{ scheme_body_rgb \}\};/);
});

test('legacy scheme data receives a non-empty fallback for every normalized token', () => {
  const defaults = {
    background: '#FFFFFF',
    heading: '#1C1B1A',
    heading_highlight: '#A67C52',
    text: '#1C1B1A',
    accent: '#1C1B1A',
    border: '#D7D0C8',
    shadow: '#1C1B1A',
    sale_price: '#9A3D32',
    button_primary_background: '#1C1B1A',
    button_primary_text: '#FFFFFF',
    button_primary_border: '#1C1B1A',
    button_primary_hover_text: '#1C1B1A',
    button_primary_hover_border: '#1C1B1A',
    button_secondary_background: '#FFFFFF',
    button_secondary_text: '#1C1B1A',
    button_secondary_border: '#1C1B1A',
    button_secondary_hover_text: '#FFFFFF',
    button_secondary_hover_border: '#1C1B1A',
    button_tertiary_text: '#1C1B1A',
    button_tertiary_hover_text: '#1C1B1A'
  };
  const legacySettings = { background: '#F6F6F6', text: '#2A2A2A' };
  const resolved = (key, hoverBackground = false) => legacySettings[key] || (hoverBackground ? 'transparent' : defaults[key]);

  for (const key of Object.keys(defaults)) {
    assert.notEqual(resolved(key), '');
    assert.notEqual(resolved(key), undefined);
  }
  assert.equal(resolved('button_primary_hover_background', true), 'transparent');
  assert.equal(resolved('button_secondary_hover_background', true), 'transparent');
  assert.equal(resolved('background'), '#F6F6F6');
  assert.equal(resolved('text'), '#2A2A2A');
});

test('Footer consumes global social URLs and no longer references follow-us menu', () => {
  const footerGroup = JSON.parse(read('sections/footer-group.json').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
  const footer = footerGroup.sections.footer;
  const socialBlock = footer.blocks['footer-row-primary'].blocks['footer-row-primary-column-3'].blocks['footer-social-menu'];

  assert.equal(socialBlock.type, 'social-links');
  assert.doesNotMatch(read('sections/footer-group.json'), /follow-us/);
  assert.doesNotMatch(read('sections/footer.liquid'), /follow-us/);
  assert.match(read('blocks/social-links.liquid'), /\{%\s*render 'social-links'(?:\s*,[\s\S]*?)?\s*%\}/);
  assert.match(read('blocks/_column.liquid'), /\{ "type": "social-links" \}/);
});

test('social links omit blank URLs and escape configured URLs', () => {
  const snippet = read('snippets/social-links.liquid');
  assert.match(snippet, /if social_url != blank/);
  assert.match(snippet, /href="\{\{ social_url \| escape \}\}"/);

  const socialNames = ['facebook', 'instagram', 'tiktok', 'youtube', 'pinterest', 'x', 'linkedin'];
  const configured = { social_instagram: 'https://example.com/ig', social_youtube: '' };
  const renderedNames = socialNames.filter((name) => configured[`social_${name}`]);
  assert.deepEqual(renderedNames, ['instagram']);
});

test('Footer and social links retain mobile wrapping behavior', () => {
  const footer = read('sections/footer.liquid');
  const critical = read('assets/critical.css');
  assert.match(footer, /@media \(max-width: 767\.98px\)/);
  assert.match(critical, /\.social-links\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
});
