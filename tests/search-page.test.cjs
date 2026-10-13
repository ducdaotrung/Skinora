const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture(smart = false) {
  class Element extends EventTarget {
    constructor(dataset = {}) { super(); this.dataset = dataset; this.attributes = {}; this.hidden = false; const classes=new Set(); this.classList = { add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); } }; this.style = {setProperty(){}}; this.contains=()=>false; }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }
    focus() { this.focused = true; }
  }
  const tabs = ['products', 'pages'].map((type) => new Element({ searchPageTab: type }));
  tabs[0].setAttribute('aria-selected', 'true');
  const panels = ['products', 'pages'].map((type) => new Element({ searchPagePanel: type }));
  const input = new Element(); input.value = 'rings';
  const clear = new Element(), form = new Element(); clear.form=form;
  const anchor=new Element({smartEnabled:String(smart)}), results=new Element(), backdrop=new Element(); anchor.querySelector=(s)=>s.includes('input')?input:results; anchor.getBoundingClientRect=()=>({bottom:200}); results.querySelector=()=>null;
  const tabRoot=new Element(); tabRoot.querySelectorAll=(s)=>s.includes('tab]')?tabs:panels;
  const root = new Element();
  root.matches = (s) => s === '[data-search-page]';
  root.querySelectorAll = (s) => ({ '[data-search-results-tabs]': [tabRoot], '[data-search-page-tab]': tabs, '[data-search-page-panel]': panels })[s] || [];
  root.querySelector = (s) => ({ '[data-search-smart]': anchor, '[data-search-page-clear]': clear, '[data-search-smart-backdrop]': backdrop })[s];
  const recorded=[]; let cleared=0;
  const doc = new Element(); doc.querySelectorAll = () => [root];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/search-page.js'), 'utf8'), { document: doc, AbortController, URLSearchParams, window:Object.assign(new Element(),{location:{pathname:'/search',search:''},innerHeight:800,ThemeSearchSuggestions:{escape:String,recent:async()=>{},request:async()=>({}),render:async()=>{},recordSearch:value=>recorded.push(value),clearHistory:()=>cleared++}}), clearTimeout,setTimeout });
  const keyboard = (tab, key) => { const event = new Event('keydown', { cancelable: true }); event.key = key; tab.dispatchEvent(event); return event; };
  const lifecycle = (name) => { const event = new Event(name); Object.defineProperty(event, 'target', { value: root }); doc.dispatchEvent(event); };
  return { tabs, panels, input, clear, form, keyboard, lifecycle, anchor, results, backdrop, recorded, get cleared(){return cleared;} };
}
test('keyboard tab activation changes selected panel and roving focus', () => {
  const f = fixture();
  assert.equal(f.panels[1].hidden, true);
  const event = f.keyboard(f.tabs[0], 'ArrowRight');
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.tabs[0].tabIndex, -1);
  assert.equal(f.tabs[1].tabIndex, 0);
  assert.equal(f.tabs[1].focused, true);
  assert.equal(f.panels[0].hidden, true);
  assert.equal(f.panels[1].hidden, false);
  f.keyboard(f.tabs[1], 'Home');
  assert.equal(f.tabs[0].getAttribute('aria-selected'), 'true');
  f.keyboard(f.tabs[0], 'ArrowLeft');
  assert.equal(f.tabs[1].getAttribute('aria-selected'), 'true');
});
test('query switches the trailing icon from search to clear and clear restores search', () => {
  const f = fixture(); assert.equal(f.clear.hidden, false); assert.equal(f.form.classList.contains('has-query'), true);
  f.clear.dispatchEvent(new Event('click'));
  assert.equal(f.input.value, ''); assert.equal(f.clear.hidden, true); assert.equal(f.input.focused, true); assert.equal(f.form.classList.contains('has-query'), false);
  f.input.value = 'new term'; f.input.dispatchEvent(new Event('input')); assert.equal(f.clear.hidden, false); assert.equal(f.form.classList.contains('has-query'), true);
});
test('editor unload aborts handlers and load initializes once', () => {
  const f = fixture(); f.lifecycle('shopify:section:unload');
  f.clear.dispatchEvent(new Event('click')); assert.equal(f.input.value, 'rings');
  f.lifecycle('shopify:section:load'); f.lifecycle('shopify:section:load');
  let focuses = 0; f.tabs[1].focus = () => focuses++;
  f.keyboard(f.tabs[0], 'End'); assert.equal(focuses, 1);
});

test('smart focus keeps the same input and query/caret; Escape closes without clearing', () => {
 const f=fixture(true), original=f.input;
 f.input.selectionStart=2;
 f.input.dispatchEvent(new Event('focus'));
 assert.strictEqual(f.input,original); assert.equal(f.input.value,'rings'); assert.equal(f.input.selectionStart,2); assert.equal(f.backdrop.hidden,false);
 const event=new Event('keydown',{cancelable:true}); event.key='Escape'; f.anchor.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true); assert.equal(f.backdrop.hidden,true); assert.equal(f.input.value,'rings'); assert.equal(f.input.selectionStart,2); assert.equal(f.input.focused,true);
 f.lifecycle('shopify:section:unload');
});
test('result navigation closes smart backdrop before shared overlay handoff', () => {
 const f=fixture(true); f.input.dispatchEvent(new Event('focus'));
 const click=new Event('click'); Object.defineProperty(click,'target',{value:{closest:selector=>selector==='a'||selector==='a,button[type="submit"]'?{closest:()=>null}:null}});
 f.results.dispatchEvent(click);
 assert.equal(f.backdrop.hidden,true); assert.equal(f.results.hidden,true); assert.equal(f.input.value,'rings');
 f.lifecycle('shopify:section:unload');
});

test('history records submits, replays into same input and clears via scoped control',()=>{
 const f=fixture(true);f.form.dispatchEvent(new Event('submit'));assert.deepEqual(f.recorded,['rings']);
 const replay=new Event('click');Object.defineProperty(replay,'target',{value:{closest:selector=>selector==='[data-search-suggestion]'?{dataset:{searchSuggestion:'Aurelia'}}:null}});
 f.results.dispatchEvent(replay);assert.equal(f.input.value,'Aurelia');assert.equal(f.input.focused,true);assert.deepEqual(f.recorded,['rings']);
 const clear=new Event('click');Object.defineProperty(clear,'target',{value:{closest:selector=>selector==='[data-search-history-clear]'?{}:null}});
 f.results.dispatchEvent(clear);assert.equal(f.cleared,1);f.lifecycle('shopify:section:unload');
 f.form.dispatchEvent(new Event('submit'));assert.deepEqual(f.recorded,['rings']);
});
