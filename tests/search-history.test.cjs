const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(blocked=false,landedQuery=''){
 const values=new Map([['product-history','keep']]);
 const storage={getItem:key=>{if(blocked)throw Error('blocked');return values.get(key)||null;},setItem:(key,value)=>{if(blocked)throw Error('blocked');values.set(key,value);},removeItem:key=>{if(blocked)throw Error('blocked');values.delete(key);}};
 const window={ThemeRecentlyViewed:{read:()=>[],load:async()=>[]}};
 vm.runInNewContext(fs.readFileSync('assets/search-suggestions.js','utf8'),{window,localStorage:storage,location:{origin:'https://example.com',pathname:'/search',search:`?q=${encodeURIComponent(landedQuery)}`},document:{querySelector:()=>landedQuery?{dataset:{searchUrl:'/search'}}:null},URLSearchParams,CustomEvent});
 return {service:window.ThemeSearchSuggestions,values};
}
test('landed search query is captured when the shared service loads after its controller',()=>{
 assert.deepEqual(Array.from(setup(false,' ring  gold ').service.readHistory()),['ring gold']);
});
test('submitted history normalizes, deduplicates and bounds newest queries; clear preserves product history',()=>{
 const {service,values}=setup();
 for(const query of [' ring  gold ','FAQ','Aurelia','silver','bracelet','earrings','RING gold'])service.recordSearch(query);
 assert.deepEqual(Array.from(service.readHistory()),['RING gold','earrings','bracelet','silver','Aurelia']);
 service.recordSearch('   ');assert.equal(service.readHistory().length,5);
 service.clearHistory();assert.equal(service.readHistory().length,0);assert.equal(values.get('product-history'),'keep');
});
test('blocked or malformed storage is omitted without throwing',async()=>{
 const blocked=setup(true);blocked.service.recordSearch('ring');blocked.service.clearHistory();assert.equal(blocked.service.readHistory().length,0);
 const f=setup();f.values.set('spinel:recent-searches:v1','{"bad":true}');assert.equal(f.service.readHistory().length,0);
 f.values.set('spinel:recent-searches:v1','[null,42," ring ","RING"]');assert.deepEqual(Array.from(f.service.readHistory()),['ring']);
});
test('history renders escaped replay controls without smart tabs and abort prevents stale blank content',async()=>{
 const {service}=setup();service.recordSearch('<img src=x onerror=alert(1)>');
 const target={innerHTML:'old',append(){},dispatchEvent(){}};
 const root={dataset:{recentSearchesLabel:'Recent searches',clearHistoryLabel:'Clear all',recentLabel:'Recently viewed'}};
 await service.recent(root,target,new AbortController().signal);
 assert.equal(target.hidden,false);assert.match(target.innerHTML,/data-search-suggestion="&lt;img/);assert.doesNotMatch(target.innerHTML,/<img/);assert.match(target.innerHTML,/data-search-history-clear/);assert.doesNotMatch(target.innerHTML,/role="tablist"/);
 const controller=new AbortController();controller.abort();target.innerHTML='new';await service.recent(root,target,controller.signal);assert.equal(target.innerHTML,'new');
 service.clearHistory();await service.recent(root,target,new AbortController().signal);assert.equal(target.hidden,true);
});
