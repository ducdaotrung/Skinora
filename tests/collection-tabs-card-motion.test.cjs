const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture({delay = 150, type = 'slide-bottom', preserveOpacity = false, switching = false, rowDelay = 0, motionDuration = 500, motionDistance = 50} = {}) {
  let changed;
  let motionChanged;
  const classes = new Set();
  const played = [];
  const slideClasses = new Set(['swiper-slide-active']);
  const slide = { classList: { contains: c => slideClasses.has(c) }, matches: s => s.includes('.slideshow__swiper .swiper-slide'), contains: e => e === block,
    isConnected: true, getClientRects: () => [{}], closest: s => s === '.slideshow__swiper .swiper-slide' ? slide : null };
  const viewport = { getBoundingClientRect: () => ({ top: 100, bottom: 920, left: 0, right: 1920 }) };
  const block = {
    dataset: { blockAnimation: type, animationDelay: String(delay), animationPreserveOpacity: String(preserveOpacity), animationStagger:switching ? '150' : '0', animationRowDelay:String(rowDelay), animationTabDelay:String(rowDelay) }, isConnected: true,
    parentElement: { closest: () => null }, querySelectorAll: () => [],
    classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
    closest: s => s === '[data-collection-tab-panel]' && switching ? viewport : s === '.slideshow' ? viewport : s === '.slideshow__swiper .swiper-slide' ? slide : null,
    matches: () => true,
    getClientRects: () => [{}], getBoundingClientRect: () => ({ top: 700, bottom: 750, left: 0, right: 300 }),
    animate: (frames, options) => { const animation = { finished: new Promise(() => {}), cancel: () => { animation.cancelled = true; } }; played.push({ frames, options, animation }); return animation; },
  };
  const document = {
    body: { dataset: {} }, addEventListener() {},
    querySelectorAll: s => s === '[data-block-animation], [data-component-reveal]' ? [block] : [],
  };
  const context = {
    window: {}, document, innerWidth: 1920, innerHeight: 450,
    matchMedia: () => ({ matches: false, addEventListener(event, callback) { motionChanged = callback; } }),
    getComputedStyle: () => ({ getPropertyValue: key => key === '--tab-card-duration' ? String(motionDuration) : key === '--tab-card-distance' ? String(motionDistance) : '' }),
    IntersectionObserver: class { observe() {} unobserve() {} },
    MutationObserver: class { constructor(fn) { changed = fn; } observe() {} },
  };
  vm.runInNewContext(fs.readFileSync('assets/block-animations.js', 'utf8'), context);
  return { block, slide, played, classes, slideClasses, changed: records => changed(records), motionChanged: () => motionChanged() };
}
 test('tab-switch card motion starts immediately with responsive duration, distance and row delay', () => {
  const first=fixture({delay:0,switching:true});
  assert.equal(first.played[0].options.delay,0);
  assert.equal(first.played[0].options.duration,500);
  assert.equal(first.played[0].options.easing,'ease');
  assert.equal(first.played[0].frames[0].transform,'translateY(50px)');
  const mobile=fixture({delay:0,switching:true,rowDelay:50,motionDuration:300,motionDistance:30});
  assert.equal(mobile.played[0].options.delay,50);
  assert.equal(mobile.played[0].options.duration,300);
  assert.equal(mobile.played[0].frames[0].transform,'translateY(30px)');
});
test('collection tab list reveals together and ignores horizontal clipping of carousel cards', () => {
  const h=fixture({delay:0,switching:true,rowDelay:300});
  h.block.getBoundingClientRect=()=>({top:100,bottom:200,left:2100,right:2400});
  h.slideClasses.clear();h.changed([{type:'attributes',attributeName:'class',target:h.slide}]);
  h.slideClasses.add('swiper-slide-active');h.changed([{type:'attributes',attributeName:'class',target:h.slide}]);
  assert.equal(h.played.length,2);assert.equal(h.played[1].options.delay,300);
  assert.equal(h.played[1].options.easing,'ease');
});
test('each tab card has one delayed animation coupling opacity and translation from start to finish', () => {
  const h=fixture({delay:0,switching:true,rowDelay:200});
  assert.equal(h.played.length,1);
  const {frames,options}=h.played[0];
  assert.equal(options.delay,200);assert.equal(options.fill,'backwards');
  assert.equal(frames[0].opacity,0);assert.equal(frames[0].transform,'translateY(50px)');
  assert.equal(frames[1].opacity,1);assert.equal(frames[1].transform,'none');
});
