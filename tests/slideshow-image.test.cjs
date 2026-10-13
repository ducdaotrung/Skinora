const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({ fs: {
  resolve: (_root, file) => path.resolve('snippets', file + '.liquid'),
  exists: async () => true,
  readFile: async file => stripShopifyMetadata(fs.readFileSync(file, 'utf8')),
} });
engine.registerFilter('image_url', (image, ...options) =>
  `/${image.name}?${options.map(([key, value]) => `${key}=${value}`).join('&')}`);
engine.registerFilter('image_tag', (url, ...options) => {
  const props = Object.fromEntries(options);
  return `<img src="${url}" srcset="${props.widths.split(',').map(w => `${url.replace(/width=\d+/, `width=${w.trim()}`)} ${w.trim()}w`).join(', ')}" sizes="${props.sizes}">`;
});
engine.registerFilter('handleize', value => value);
const source = stripShopifyMetadata(fs.readFileSync('blocks/slideshow-slide.liquid', 'utf8')).replace(/{%\s*content_for[^%]*%}/g, '');
const sectionSource = fs.readFileSync('sections/slideshow.liquid', 'utf8');
const schema = JSON.parse(sectionSource.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
const image = { name: 'desktop.jpg', aspect_ratio: 3, width: 6000, height: 2000, presentation: { focal_point: '50.0% 50.0%' } };
async function render(height, settings = {}) {
  const block = { id: 'first', settings: { image, ...settings } };
  return engine.parseAndRender(source, { block, section: { index: 1, blocks: [block], settings: { mobile_height: height } } });
}
const fixed = { extra_small: 320, small: 440, medium: 560, large: 680, extra_large: 820 };
for (const option of schema.settings.find(s => s.id === 'mobile_height').options) {
  test(`real slide caller: ${option.value} matches CSS and preload/picture sources`, async () => {
    for (const mobile of [undefined, { ...image, name: 'mobile.jpg' }]) {
      const html = await render(option.value, { mobile_image: mobile });
      const picture = html.match(/<picture>[\s\S]*?<\/picture>/)[0];
      const sources = [...picture.matchAll(/<source[^>]*srcset="([^"]+)"/g)].map(m => m[1]);
      for (const srcset of sources) assert.ok(html.includes(`imagesrcset="${srcset}"`));
      assert.ok(sources.every(s => s.includes(mobile ? '/mobile.jpg?' : '/desktop.jpg?')));
      if (fixed[option.value]) {
        const height = fixed[option.value];
        assert.ok(sectionSource.includes(`.slideshow--mobile-${option.value} { --slideshow-height-mobile: ${height / 10}rem; }`));
        assert.equal(sources.length, 2);
        assert.ok(sources[0].includes(`width=480&amp;height=${height}&amp;crop=center 1x`));
        assert.ok(sources[1].includes(`width=768&amp;height=${height}&amp;crop=center 1x`));
        for (const match of picture.matchAll(/height=(\d+)&amp;crop=center/g)) assert.ok(+match[1] <= image.height);
        if (height * 3 <= image.height) assert.ok(sources[0].includes(`height=${height * 3}&amp;crop=center 3x`));
      } else {
        assert.ok(!picture.includes('crop=center'));
        assert.ok(sources[0].includes('750w') && sources[0].includes('1500w') && sources[0].includes('2400w'));
        assert.ok(picture.includes('sizes="100vw"'));
      }
    }
  });
}
test('missing preset uses the actual small default and focal points avoid center crops', async () => {
  assert.ok((await render(undefined)).includes('height=440&amp;crop=center'));
  const focal = { ...image, presentation: { focal_point: '75% 25%' } };
  const html = await render('large', { image: focal });
  assert.ok(!html.includes('crop=center'));
  assert.ok(html.includes('max(100vw, 2040px)'));
});
test('portrait art and source resolution limits preserve valid responsive candidates', async () => {
  const portrait = await render('large', { mobile_image: { ...image, name: 'portrait.jpg', aspect_ratio: .5 } });
  assert.ok(!portrait.includes('crop=center'));
  const small = await render('large', { image: { ...image, height: 340, width: 1020 } });
  assert.ok(small.includes('width=240&amp;height=340&amp;crop=center 0.5x'));
  assert.ok(!small.includes('height=680&amp;crop=center'));
});
module.exports = { render };
