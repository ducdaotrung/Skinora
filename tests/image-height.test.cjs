const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({fs: {
  resolve: (_root, name) => path.resolve('snippets', name + '.liquid'),
  exists: async () => true,
  readFile: async file => stripShopifyMetadata(fs.readFileSync(file, 'utf8')),
}});
engine.registerFilter('image_url', (image, ...params) => '/' + image.src + '?' + params.map(([k,v]) => `${k}=${v}`).join('&'));
engine.registerFilter('image_tag', (url, ...params) => `<img src="${url}" ${params.map(([k,v]) => `${k}="${v}"`).join(' ')}>`);
const source = stripShopifyMetadata(fs.readFileSync('blocks/image.liquid','utf8'));
const image = {src:'logo.png', width:800, height:400};

test('auto image height fills only the requested device and fixed ratios ignore saved Fill', async () => {
  for (const [desktopRatio, mobileRatio, expectedDesktop, expectedMobile] of [
    ['auto','auto',true,false], ['square','auto',false,false], ['auto','custom',true,false]
  ]) {
    const html = await engine.parseAndRender(source, {section:{index:5},block:{settings:{image,image_ratio_desktop:desktopRatio,image_ratio_mobile:mobileRatio,height_desktop:'fill',height_mobile:'auto'}}});
    assert.equal(/image-block--height-fill(?:\s|\")/.test(html), expectedDesktop);
    assert.equal(html.includes('image-block--height-fill-mobile'), expectedMobile);
  }
  const mobile = await engine.parseAndRender(source, {section:{index:5},block:{settings:{image,image_ratio_desktop:'auto',image_ratio_mobile:'auto',height_desktop:'auto',height_mobile:'fill'}}});
  assert.match(mobile,/image-block--height-fill-mobile/);
  assert.match(mobile,/--image-block-image-height: auto/);
});
