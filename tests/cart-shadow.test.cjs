const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('cart panels preserve the scheme Shadow alpha instead of applying transparency twice', () => {
  const schema = JSON.parse(fs.readFileSync('config/settings_schema.json', 'utf8'));
  const schemes = schema.flatMap(group => group.settings || []).find(setting => setting.id === 'color_schemes');
  const shadow = schemes.definition.find(setting => setting.id === 'shadow');
  assert.equal(shadow.alpha, true);
  const surface = fs.readFileSync('snippets/cart-surface-style.liquid', 'utf8');
  const declaration = surface.slice(surface.indexOf('--cart-surface-shadow:'));
  assert.match(declaration, /var\(--shadow-color\)/);
  assert.doesNotMatch(declaration, /color-mix|transparent|--body-color/);
  for (const file of ['_cart-order-summary', 'cart-order-note', 'cart-shipping-estimator']) {
    assert.match(fs.readFileSync(`blocks/${file}.liquid`, 'utf8'), /render 'cart-surface-style'/);
  }
});
