const fs = require('node:fs');
function migrate(document) {
  let changed = 0;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['blog-posts', 'featured-blog-posts'].includes(node.type)) {
      node.settings ||= {};
      if (!Object.hasOwn(node.settings, 'blog')) {
        const resourceType = node.type === 'blog-posts' ? 'blog-list' : 'blog-grid';
        const owner = Object.values(node.blocks || {}).find((block) => block.type === resourceType);
        node.settings.blog = owner?.settings?.blog || '';
        changed += 1;
      }
    }
    Object.values(node).forEach(visit);
  }
  visit(document);
  return changed;
}
if (require.main === module) {
  for (const file of process.argv.slice(2)) {
    const source = fs.readFileSync(file, 'utf8');
    const prefix = source.match(/^\s*\/\*[\s\S]*?\*\/\s*/)?.[0] || '';
    const document = JSON.parse(source.slice(prefix.length));
    const changed = migrate(document);
    if (changed) {
      fs.writeFileSync(file, prefix + JSON.stringify(document, null, 2) + '\n');
      console.log(`${file}: migrated ${changed} blog section(s)`);
    }
  }
}
module.exports = { migrate };
