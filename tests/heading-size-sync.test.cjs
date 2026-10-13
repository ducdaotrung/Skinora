const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadLiquid,stripShopifyMetadata}=require(process.cwd()+'/tests/helpers/liquid-engine.cjs');
const scale=['display','xl','lg','md','sm','xs'];
const engine=new (loadLiquid())({fs:{resolve:(_r,f)=>path.resolve('snippets',f+'.liquid'),exists:async()=>true,readFile:async f=>stripShopifyMetadata(fs.readFileSync(f,'utf8'))}});
engine.registerFilter('placeholder_svg_tag',()=>'<svg></svg>');
test('all heading size options use visual tokens, keeping HTML tags separate',()=>{
function walk(o,file){if(Array.isArray(o))return o.forEach(x=>walk(x,file));if(!o||typeof o!=='object')return;if(o.type==='select'&&/size/.test(o.id)){assert.ok(!o.options.some(x=>/^(h[1-6]|heading_[1-6])$/.test(x.value)),file+':'+o.id);assert.ok(o.options.some(x=>x.value===o.default),file+':default');}Object.values(o).forEach(x=>walk(x,file));}
for(const dir of ['blocks','sections'])for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.liquid'))){const m=fs.readFileSync(dir+'/'+f,'utf8').match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);if(m)walk(JSON.parse(m[1]),dir+'/'+f);}
});
test('thumbnail renders all visual sizes and saved aliases without changing HTML tag',async()=>{
const src=stripShopifyMetadata(fs.readFileSync('blocks/collection-thumbnail.liquid','utf8'));
for(const [i,v]of scale.entries())for(const saved of [v,'h'+(i+1),'heading_'+(i+1)]){
const html=await engine.parseAndRender(src,{block:{settings:{custom_title:'Collection'}},section:{settings:{heading_size:saved,html_tag:'h3'}}});
assert.match(html,new RegExp('<h3[^>]*heading-'+v+'[^>]*>Collection</h3>'));
}
});
test('article heading legacy values map to the selected visual token',async()=>{
const src=stripShopifyMetadata(fs.readFileSync('blocks/blog-meta.liquid','utf8'));
const eng=new (loadLiquid())({fs:{resolve:(_r,f)=>path.resolve('snippets',f+'.liquid'),exists:async()=>true,readFile:async f=>stripShopifyMetadata(fs.readFileSync(f,'utf8'))}});
for(const [i,v]of scale.entries())for(const saved of [v,'h'+(i+1),'heading_'+(i+1)]){
const html=await eng.parseAndRender(src,{block:{settings:{title_size:saved,html_title_tag:'h3'}},article:{title:'Article'}});assert.match(html,new RegExp('<h3[^>]*heading-'+v+'[^>]*>Article</h3>'));
}
});
test('featured post and collection tabs consume all six selected sizes',async()=>{
for(const [i,v]of scale.entries())for(const saved of [v,'h'+(i+1),'heading_'+(i+1)]){
const title=stripShopifyMetadata(fs.readFileSync('blocks/featured-post.liquid','utf8')).replace(/{%\s*content_for[^%]*%}/g,'');
const html=await engine.parseAndRender(title,{block:{settings:{title_size:saved,show_title:true}},blog:{articles:[{title:'Featured'}]}});
assert.ok(html.includes('heading-'+v)||html.includes('blog-card__title--'+v),saved);
const tab=stripShopifyMetadata(fs.readFileSync('blocks/collections-with-tabs-item.liquid','utf8'));
const tabHtml=await engine.parseAndRender(tab,{block:{settings:{custom_title:'Collection'}},section:{settings:{title_size:saved,title_tag:'h3'}}});
assert.match(tabHtml,new RegExp('<h3[^>]*(?:tab-title--|heading-)'+v+'[^>]*>Collection</h3>'));
}
});
test('thumbnail custom size renders pixels independently of its HTML tag',async()=>{
const src=stripShopifyMetadata(fs.readFileSync('blocks/collection-thumbnail.liquid','utf8'));
const html=await engine.parseAndRender(src,{block:{settings:{custom_title:'Custom'}},section:{settings:{heading_size:'custom',custom_heading_size:37,html_tag:'h3'}}});
assert.match(html,/<h3[^>]*heading-custom[^>]*style="font-size: 37px;"[^>]*>Custom<\/h3>/);
});
test('global typography groups use the same names as visual heading options',()=>{
const src=fs.readFileSync('config/settings_schema.json','utf8');
for(const [i,v]of scale.entries()){assert.ok(!src.includes('"t:general.heading_'+(i+1)+'"'));assert.ok(src.includes('"t:options.heading_size.'+v+'"'));}
});
