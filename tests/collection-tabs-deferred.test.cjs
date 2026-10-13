const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadLiquid} = require('./helpers/liquid-engine.cjs');
const source = fs.readFileSync('blocks/tab-layout.liquid','utf8');
const loader = source.slice(source.indexOf('  const clearPendingTab ='),source.indexOf('  const scheduleSynchronization ='));
function fixture({motion = false, reduced = false} = {}) {
  const calls = [], instances = new WeakMap(), status={textContent:''};
  const panels = ['best','new','sale'].map(id => {
    const attributes = new Set(id==='best'?[]:['data-tab-deferred']);
    const panel={id,dataset:{tabId:id,sectionId:'template--1__tabs'},hidden:id!=='best',inert:false,
      hasAttribute:key=>attributes.has(key),setAttribute:key=>attributes.add(key),removeAttribute:key=>attributes.delete(key),
      replaceChildren:(...children)=>{panel.children=children;},append(){}};
    if (motion) panel.animate = (frames, options) => {
      let resolve, reject;
      const animation = {frames,options,finished:new Promise((a,b)=>{resolve=a;reject=b;}),finish:()=>resolve(),cancel:()=>reject(new Error('cancelled'))};
      panel.animations = [...(panel.animations || []),animation];
      return animation;
    };
    return panel;
  });
  const state={layout:{dataset:{}},entries:panels.map(panel=>({panel,tab:{dataset:{}},trigger:{dataset:{tabId:panel.id},setAttribute(){},focus(){}}})),controller:new AbortController(),scope:{dataset:{tabLoadError:'Unable to load products'},querySelector:()=>status}};
  state.activeEntry=state.entries[0];instances.set(state.layout,state);
  const context={instances,window:{location:{href:'https://example.test/fr/?preview_theme_id=123&pb=0'}},URL,
    synchronizeEntries(){},updateViewAll(){},updateExternalNavigation(){},prefersReducedMotion:()=>reduced,
    animatePanel(state,panel){state.incomingPanel=panel;state.panelAnimation?.cancel();},cancelPanelAnimation(state){state.panelAnimation?.cancel();state.panelAnimation=null;},
    fetch:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject})),
    DOMParser:class {parseFromString(html){return {getElementById:id=>html==='incomplete'?null:{childNodes:[id+' products'],hasAttribute:()=>false},querySelectorAll:()=>[]};}}
  };
  vm.runInNewContext(loader+'\nthis.load = loadDeferredPanels;this.select = setActiveTab;this.prefetch = requestTabSection;',context);
  return {state,panels,calls,instances,status,prefetch:()=>context.prefetch(state),load:()=>context.load(state),select:id=>context.select(state,id,false,true)};
}
test('loading keeps the active products visible and inert without replacing content until completion',async()=>{
  const h=fixture();h.select('new');const attempt=h.state.loadingPanels;
  assert.equal(h.state.activeEntry.panel.id,'best');assert.equal(h.panels[0].hidden,false);
  assert.equal(h.panels[1].hidden,true);assert.equal(h.panels[0].dataset.tabLoading,'true');assert.equal(h.panels[0].inert,true);
  h.calls[0].resolve({ok:true,text:async()=>'valid'});await attempt;
  assert.equal(h.state.activeEntry.panel.id,'new');assert.equal(h.panels[1].hidden,false);
  assert.equal(h.panels[0].inert,false);assert.equal(h.panels[0].dataset.tabLoading,undefined);
});
test('cached tab transition finishes the downward exit before revealing the incoming tab',async()=>{
  const h=fixture({motion:true});h.panels[1].removeAttribute('data-tab-deferred');h.select('new');
  assert.equal(h.panels[0].hidden,false);assert.equal(h.panels[1].hidden,true);
  const exit=h.panels[0].animations[0];assert.equal(exit.options.duration,150);assert.equal(exit.frames[1].transform,'translateY(2rem)');
  exit.finish();await Promise.resolve();
  assert.equal(h.panels[0].hidden,true);assert.equal(h.panels[1].hidden,false);assert.equal(h.state.incomingPanel,h.panels[1]);assert.equal(h.panels[1].dataset.tabReveal,'switch');
});
test('rapid cached switches cancel stale exits and reduced motion switches immediately',async()=>{
  const h=fixture({motion:true});h.panels.slice(1).forEach(p=>p.removeAttribute('data-tab-deferred'));
  h.select('new');const stale=h.panels[0].animations[0];h.select('sale');stale.finish();h.panels[0].animations[1].finish();await Promise.resolve();
  assert.equal(h.state.activeEntry.panel.id,'sale');
  const r=fixture({motion:true,reduced:true});r.panels[1].removeAttribute('data-tab-deferred');r.select('new');assert.equal(r.state.activeEntry.panel.id,'new');assert.equal(r.panels[0].animations,undefined);
});
test('rapid selections share one request and the last requested tab wins',async()=>{
  const h=fixture();h.select('new');const a=h.state.loadingPanels;h.select('sale');
  assert.equal(h.calls.length,1);assert.equal(h.state.loadingPanels,a);assert.equal(h.state.activeEntry.panel.id,'best');
  assert.equal(h.calls[0].url.pathname,'/fr/');assert.equal(h.calls[0].url.searchParams.get('preview_theme_id'),'123');
  h.calls[0].resolve({ok:true,text:async()=>'valid'});await a;
  assert.equal(h.state.activeEntry.panel.id,'sale');
  h.select('new');assert.equal(h.calls.length,1);
});
test('returning to the current tab cancels the pending selection without a late tab switch',async()=>{
  const h=fixture();h.select('new');const a=h.state.loadingPanels;h.select('best');
  assert.equal(h.panels[0].inert,false);assert.equal(h.state.requestedTabId,null);
  h.calls[0].resolve({ok:true,text:async()=>'valid'});await a;
  assert.equal(h.state.activeEntry.panel.id,'best');
});
test('failed or incomplete responses keep current products usable and allow retry by selecting the tab again',async()=>{
  for(const incomplete of [false,true]){
    const h=fixture();h.select('new');const a=h.state.loadingPanels;h.calls[0].resolve({ok:incomplete,text:async()=>'incomplete'});await a;
    assert.equal(h.state.activeEntry.panel.id,'best');assert.equal(h.panels[0].inert,false);assert.equal(h.panels[0].dataset.tabLoading,undefined);assert.equal(h.status.textContent,'Unable to load products');
    h.select('new');const b=h.state.loadingPanels;assert.equal(h.calls.length,2);h.calls[1].resolve({ok:true,text:async()=>'valid'});await b;
    assert.equal(h.state.activeEntry.panel.id,'new');
  }
});
test('section unloading prevents stale responses replacing editor content',async()=>{
  const h=fixture();h.select('new');const a=h.state.loadingPanels;h.instances.delete(h.state.layout);h.state.controller.abort();
  h.calls[0].resolve({ok:true,text:async()=>'valid'});await a;
  assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.panels[1].children,undefined);
});
test('only unselected storefront tabs defer; initial, editor and section API remain rendered',async()=>{
  const Liquid=loadLiquid();const engine=new Liquid();const block=fs.readFileSync('blocks/collection-tab.liquid','utf8');
  const gate=block.slice(block.indexOf('  assign collection_tab_deferred ='),block.indexOf('{% unless collection_tab_deferred %}'));
  const template='{% liquid\n'+gate+'{% if collection_tab_deferred %}deferred{% else %}products{% endif %}';
  for(const [index,editor,initial,expected] of [[3,false,false,'deferred'],[3,false,true,'products'],[3,true,false,'products'],[null,false,false,'products']]){
    assert.equal((await engine.parseAndRender(template,{section:{index},request:{design_mode:editor},collection_tab_is_initial:initial})).trim(),expected);
  }
});
test('first dynamic Theme Block stays initial when Shopify reports generic @theme types',async()=>{
  const Liquid=loadLiquid();const engine=new Liquid();const block=fs.readFileSync('blocks/collection-tab.liquid','utf8');
  const start=block.indexOf('  assign collection_tab_first_block =');
  const code='{% liquid\n'+block.slice(start,block.indexOf('  assign collection_tab_deferred =',start))+'%}{{ collection_tab_is_initial }}';
  const section={blocks:[{id:'first',type:'@theme'},{id:'second',type:'@theme'}]};
  assert.equal((await engine.parseAndRender(code,{section,block:{id:'first'}})).trim(),'true');
  assert.equal((await engine.parseAndRender(code,{section,block:{id:'second'}})).trim(),'false');
});

test('response prefetch leaves deferred panels empty and the first click consumes the cached response',async()=>{
  const h=fixture();const warm=h.prefetch();
  h.calls[0].resolve({ok:true,text:async()=>'valid'});await warm;
  assert.equal(h.panels[1].children,undefined);
  assert.equal(h.panels[1].hasAttribute('data-tab-deferred'),true);
  assert.equal(h.state.activeEntry.panel.id,'best');
  h.select('new');await h.state.loadingPanels;
  assert.equal(h.calls.length,1);assert.equal(h.state.activeEntry.panel.id,'new');
});
test('click during prefetch shares the request and a failed warmup can retry',async()=>{
  const h=fixture();const warm=h.prefetch();h.select('new');const loading=h.state.loadingPanels;
  assert.equal(h.calls.length,1);h.calls[0].resolve({ok:true,text:async()=>'valid'});await warm;await loading;
  assert.equal(h.state.activeEntry.panel.id,'new');
  const r=fixture();const failed=r.prefetch();r.calls[0].reject(new Error('network'));await assert.rejects(failed);
  assert.equal(r.status.textContent,'');r.select('new');const retry=r.state.loadingPanels;
  assert.equal(r.calls.length,2);r.calls[1].resolve({ok:true,text:async()=>'valid'});await retry;
  assert.equal(r.state.activeEntry.panel.id,'new');
});
