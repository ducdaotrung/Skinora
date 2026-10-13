const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid();
const source = stripShopifyMetadata(fs.readFileSync(path.join(__dirname, '../snippets/product-list-promo-items.liquid'), 'utf8'));
const card = (position, text) => `<!--promo-card-slot:${position}--><div data-promo-card>${text}</div><!--/promo-card-slot-->`;

test('inserts promos at product boundaries, preserving block order for ties', async () => {
  const cards = card(2, 'first') + card(1, 'start') + card(2, 'second');
  const start = await engine.parseAndRender(source, { cards, position: 1, last_position: 4, layout: 'grid' });
  const second = await engine.parseAndRender(source, { cards, position: 2, last_position: 4, layout: 'carousel' });
  assert.match(start, /start/); assert.doesNotMatch(start, /first|second|swiper-slide/);
  assert.ok(second.indexOf('first') < second.indexOf('second'));
  assert.equal((second.match(/class="swiper-slide /g) || []).length, 2);
  assert.doesNotMatch(second, /promo-card-slot/);
});
test('clamps out-of-range cards after the last product, including empty lists', async () => {
  const cards = card(25, 'end');
  for (const last_position of [1, 3, 25]) {
    const output = await engine.parseAndRender(source, { cards, position: last_position, last_position, layout: 'grid' });
    assert.equal((output.match(/data-product-list-promo-item/g) || []).length, 1);
    assert.match(output, /end/);
  }
});
test('missing and hidden promos produce no item or blank slide', async () => {
  const output = await engine.parseAndRender(source, { cards: '\n', position: 1, last_position: 2, layout: 'carousel' });
  assert.doesNotMatch(output, /data-product-list-promo-item|swiper-slide/);
});

const vm = require('node:vm');
function mobileFixture() {
  const events = new Map(); const changes = new Set();
  class Node {
    constructor(name, slide = false, top = false) { this.name = name; this.children = []; this.parent = null; this.style = {}; this.listeners = new Map(); this.top = top; this.classes = new Set(slide ? ['swiper-slide'] : []); this.classList = { contains: (c) => this.classes.has(c), remove: (c) => this.classes.delete(c), toggle: (c, on) => on ? this.classes.add(c) : this.classes.delete(c) }; }
    append(node) { node.remove(); this.children.push(node); node.parent = this; }
    remove() { if(this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
    before(node) { const p=this.parent;node.remove();p.children.splice(p.children.indexOf(this),0,node);node.parent=p; }
    after(node) { const p=this.parent;node.remove();p.children.splice(p.children.indexOf(this)+1,0,node);node.parent=p; }
    contains(node) { return this.children.some((n) => n === node || n.contains(node)); }
    closest() { return list; }
    querySelector(selector) { return selector.includes('mobile-top') ? this.top : null; }
    querySelectorAll() { return this.children.filter((n) => n.name.startsWith('promo')); }
    addEventListener(t,f) { this.listeners.set(t,f); }
    removeEventListener(t,f) { this.listeners.delete(t); }
  }
  const list = new Node('list'), host = new Node('host'), wrapper = new Node('wrapper');
  const promo = new Node('promoA',true,true), second = new Node('promoB',true,false), product = new Node('product',true);
  list.append(host);list.append(wrapper);wrapper.append(product);wrapper.append(promo);wrapper.append(second);
  const calls=[];const swiper={activeIndex:0,params:{slidesPerView:4},destroyed:false,get slides(){return wrapper.children.filter((n)=>n.classes.has('swiper-slide'));},update(){calls.push('update');},slideTo(i){calls.push(i);}};
  const carousel={swiper,getBoundingClientRect:()=>({left:0,right:400})};
  promo.getBoundingClientRect=()=>({left:100,right:200});
  second.getBoundingClientRect=()=>({left:200,right:300});
  list.matches=()=>true; list.querySelector=(s)=>s.includes('mobile-promos') ? host : carousel; list.querySelectorAll=()=>[promo,second];
  const query={matches:false,addEventListener(t,f){changes.add(f);},removeEventListener(t,f){changes.delete(f);}};
  const document={readyState:'loading',createComment:()=>new Node('anchor'),addEventListener:(t,f)=>events.set(t,f)};
  const source=fs.readFileSync(path.join(__dirname,'../assets/product-list-promos.js'),'utf8').replace('export const initializeThemeModule','const initializeThemeModule');
  const context={document,window:{matchMedia:()=>query}};vm.createContext(context);vm.runInContext(source+'\nglobalThis.init=initializeThemeModule;',context);
  return {list,host,wrapper,promo,second,product,events,changes,query,calls,swiper,init:context.init};
}
test('mobile promo moves once and returns to its exact desktop boundary', () => {
  const f=mobileFixture();f.init(f.list);f.init(f.list);assert.equal(f.changes.size,1);
  f.query.matches=true;f.changes.forEach((fn)=>fn());assert.deepEqual(f.host.children,[f.promo]);assert.ok(!f.promo.classes.has('swiper-slide'));assert.ok(f.wrapper.children.includes(f.second));
  f.query.matches=false;f.changes.forEach((fn)=>fn());assert.equal(f.host.children.length,0);assert.deepEqual(f.wrapper.children.filter((n)=>n.name!=='anchor'),[f.product,f.promo,f.second]);assert.ok(f.promo.classes.has('swiper-slide'));assert.ok(f.calls.includes('update'));
});
test('section unload restores moved promos and removes instance listeners', () => {
  const f=mobileFixture();f.query.matches=true;f.init(f.list);f.events.get('shopify:section:unload')({target:f.list});assert.equal(f.changes.size,0);assert.equal(f.list.listeners.size,0);assert.equal(f.host.children.length,0);assert.deepEqual(f.wrapper.children,[f.product,f.promo,f.second]);
});

test('selecting a visible promo preserves its configured position in the viewport', () => {
  const f=mobileFixture();f.init(f.list);f.calls.length=0;
  f.list.listeners.get('shopify:block:select')({target:{closest:()=>f.promo}});
  assert.deepEqual(f.calls,[]);
});
test('selecting an off-screen promo scrolls only enough to reveal it', () => {
  const f=mobileFixture();f.init(f.list);f.calls.length=0;
  f.swiper.params.slidesPerView=2;
  f.second.getBoundingClientRect=()=>({left:500,right:600});
  f.list.listeners.get('shopify:block:select')({target:{closest:()=>f.second}});
  assert.deepEqual(f.calls,[1]);
});
