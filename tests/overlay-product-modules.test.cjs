const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const overlay of ['quick-add', 'quick-view']) {
  test(`${overlay} loads the Shopify-versioned gallery before registering shared media`, async () => {
    const source = fs.readFileSync(`assets/${overlay}.js`, 'utf8');
    const modules = source.match(/const productFeatureModules = \[[\s\S]*?\];/)[0];
    const loader = source.match(/const loadProductFeatures = [\s\S]*?\n};/)[0]
      .replace(/\bimport\(/g, 'importModule(');
    const imported = [];
    const context = {
      importModule(url) { imported.push(url); return Promise.resolve(); },
      versioned: 'https://example.myshopify.com/cdn/shop/t/23/assets/product-media.js?v=123456',
    };
    vm.runInNewContext(`${modules}\nlet productFeaturesPromise;\n${loader}\nresult = loadProductFeatures(versioned);`, context);
    await context.result;
    assert.ok(imported.includes(context.versioned));
    assert.ok(!imported.includes('./product-media.js'));
    assert.ok(imported.includes('./variant-picker.js'));
    const section = fs.readFileSync(`sections/${overlay}.liquid`, 'utf8');
    assert.match(section, /data-product-media-module-url="{{ 'product-media.js' \| asset_url \| escape }}"/);
    assert.match(source, /loadProductFeatures\(this\.dialog\.dataset\.productMediaModuleUrl\)/);
  });
}
