const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const schema = p => JSON.parse(fs.readFileSync(p,'utf8').match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
const fields = [['previous-and-next-posts','title_size'],['blog-meta','title_size'],['comments','heading_size'],['featured-post','title_size'],['blog-title','heading_size'],['blog-tag-filter','heading_size']];
test('blog/article visual sizes use canonical values, labels and working Custom controls', () => {
 const canonical=schema('blocks/heading.liquid').settings.find(s=>s.id==='heading_size').options;
 for(const [name,id] of fields){const s=schema(`blocks/${name}.liquid`).settings;assert.deepEqual(s.find(x=>x.id===id).options,canonical);const custom=s.find(x=>x.id==='custom_heading_size');assert.equal(custom.visible_if,`{{ block.settings.${id} == 'custom' }}`);assert.match(fs.readFileSync(`blocks/${name}.liquid`,'utf8'),/font-size: {{ block.settings.custom_heading_size }}px/);}
});
test('legacy saved heading sizes retain their typography while canonical values pass through', () => {
 const engine=new Liquid();const source=stripShopifyMetadata(fs.readFileSync('snippets/heading-size-token.liquid','utf8'));
 const values=['display','xl','lg','md','sm','xs'];values.forEach((v,i)=>assert.equal(engine.parseAndRenderSync(source,{size:`h${i+1}`,fallback:'md'}).trim(),v));
 for(const size of [...values,'custom'])assert.equal(engine.parseAndRenderSync(source,{size,fallback:'md'}).trim(),size);
 assert.equal(engine.parseAndRenderSync(source,{size:'invalid',fallback:'md'}).trim(),'md');
});
test('section padding vocabulary and all visual heading option labels stay consistent', () => {
 const localeText=fs.readFileSync('locales/en.default.schema.json','utf8');
 const locale=JSON.parse(localeText.slice(localeText.indexOf('{')));
 const expected={padding_top:'Top',padding_bottom:'Bottom',custom_mobile_padding:'Customize for mobile',customize_mobile_padding:'Customize for mobile',padding_top_mobile:'Top (mobile)',padding_bottom_mobile:'Bottom (mobile)'};
 for(const file of fs.readdirSync('sections').filter(f=>f.endsWith('.liquid'))){
  const s=schema('sections/'+file);
  for(const x of s.settings||[])if(expected[x.id])assert.equal(x.label.startsWith('t:labels.')?locale.labels[x.label.split('.').at(-1)]:x.label,expected[x.id],file+' '+x.id);
 }
 for(const directory of ['sections','blocks'])for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.liquid'))){
  const source=fs.readFileSync(directory+'/'+file,'utf8');if(!source.includes('{% schema %}'))continue;
  for(const x of schema(directory+'/'+file).settings||[])for(const option of x.options||[])assert.doesNotMatch(option.label,/^Heading\s*[1-6]$/i,file+' '+x.id);
 }
 for(const name of ['blog-meta','comments','previous-and-next-posts','featured-post']){
  for(const x of schema('blocks/'+name+'.liquid').settings)if(['heading_size','title_size','html_title_tag','html_heading_tag'].includes(x.id))assert.equal(x.label,x.id.startsWith('html')?'t:labels.html_tag':'t:labels.heading_size');
 }
});
