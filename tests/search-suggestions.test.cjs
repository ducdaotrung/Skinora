const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Item extends EventTarget {
 constructor(key){super();this.dataset={searchSmartTab:key,searchSmartPanel:key};this.attrs={};this.hidden=true;}
 setAttribute(key,value){this.attrs[key]=value;}
 focus(){this.focused=true;}
}
class Target extends EventTarget {
 constructor(){super();this.id='SearchSuggestions-test';}
 set innerHTML(html){this.html=html;this.tabs=[...html.matchAll(/data-search-smart-tab="([^"]+)"/g)].map(match=>new Item(match[1]));this.panels=[...html.matchAll(/data-search-smart-panel="([^"]+)"/g)].map(match=>new Item(match[1]));}
 get innerHTML(){return this.html;}
 querySelectorAll(selector){return selector==='[data-search-smart-tab]'?this.tabs:this.panels;}
 querySelector(){return null;}
}
function setup(load=async()=>[]){
 const window={ThemeRecentlyViewed:{load,read:()=>[]}},root={dataset:{productsLabel:'Products',collectionsLabel:'Collections',blogPostsLabel:'Blog posts',pagesLabel:'Pages',suggestionsLabel:'Suggestions',noResultsLabel:'No results',viewAllLabel:'View all',searchUrl:'/search'}};
 vm.runInNewContext(fs.readFileSync('assets/search-suggestions.js','utf8'),{window,location:{origin:'https://example.com'},CustomEvent});
 return {service:window.ThemeSearchSuggestions,root,target:new Target()};
}
const item=(title)=>({title,url:'/pages/test'});
const keyboard=(tab,key)=>{const event=new Event('keydown',{cancelable:true});event.key=key;tab.dispatchEvent(event);return event;};
test('smart renderer keeps Suggestions above nonempty tabs and shows one selected group',async()=>{
 const f=setup();await f.service.render(f.root,f.target,{queries:[{text:'ring guide'}],products:[item('Ring')],articles:[item('Guide')],pages:[item('FAQ')]},'ring',new AbortController().signal);
 assert.ok(f.target.html.indexOf('Suggestions')<f.target.html.indexOf('role="tablist"'));
 assert.deepEqual(f.target.tabs.map(tab=>tab.dataset.searchSmartTab),['products','articles','pages']);
 assert.equal(f.root.dataset.smartActiveGroup,'products');assert.equal(f.target.panels.filter(panel=>!panel.hidden).length,1);
 assert.match(f.target.html,/<strong>ring<\/strong> guide/);assert.match(f.target.html,/aria-controls="SearchSuggestions-test-products-panel"/);
 f.target.tabs[1].dispatchEvent(new Event('click'));
 assert.equal(f.root.dataset.smartActiveGroup,'articles');assert.equal(f.target.tabs[1].attrs['aria-selected'],'true');assert.equal(f.target.panels[0].hidden,true);
});
test('tab keyboard roves focus and selection persists only while its group is available',async()=>{
 const f=setup(),signal=new AbortController().signal,data={products:[item('Ring')],collections:[item('Collection')],pages:[item('FAQ')]};
 await f.service.render(f.root,f.target,data,'ring',signal);
 assert.equal(keyboard(f.target.tabs[0],'End').defaultPrevented,true);assert.equal(f.root.dataset.smartActiveGroup,'pages');assert.equal(f.target.tabs[2].focused,true);assert.equal(f.target.tabs[0].tabIndex,-1);
 await f.service.render(f.root,f.target,data,'rings',signal);assert.equal(f.root.dataset.smartActiveGroup,'pages');
 keyboard(f.target.tabs[2],'ArrowRight');assert.equal(f.root.dataset.smartActiveGroup,'products');
 keyboard(f.target.tabs[0],'ArrowLeft');assert.equal(f.root.dataset.smartActiveGroup,'pages');
 keyboard(f.target.tabs[2],'Home');assert.equal(f.root.dataset.smartActiveGroup,'products');
 f.target.tabs[1].dispatchEvent(new Event('click'));
 await f.service.render(f.root,f.target,{pages:[item('FAQ')]},'faq',signal);assert.equal(f.root.dataset.smartActiveGroup,'pages');assert.equal(f.target.tabs.length,1);
});
test('empty and aborted requests do not leave tabs or overwrite newer result state',async()=>{
 const f=setup(),controller=new AbortController();
 await f.service.render(f.root,f.target,{},'missing',controller.signal);assert.equal(f.target.tabs.length,0);assert.match(f.target.html,/No results/);assert.match(f.target.html,/View all/);
 const before=f.target.html;controller.abort();await f.service.render(f.root,f.target,{products:[item('Old')]},'old',controller.signal);assert.equal(f.target.html,before);
 let resolveRows;const pending=setup(paths=>paths.length?new Promise(resolve=>{resolveRows=resolve;}):Promise.resolve([])),old=new AbortController();
 const earlier=pending.service.render(pending.root,pending.target,{products:[{title:'Old',url:'/products/old'}]},'old',old.signal);
 old.abort();await pending.service.render(pending.root,pending.target,{pages:[item('New FAQ')]},'faq',new AbortController().signal);
 resolveRows([]);await earlier;assert.equal(pending.root.dataset.smartActiveGroup,'pages');assert.match(pending.target.html,/New FAQ/);
});
