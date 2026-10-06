#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

// Existing IDs, settings, nested blocks, disabled state and relative order stay
// intact. Only the three former section-level static roles become dynamic.
function migrateFeaturedCollectionBanner(document) {
  let changed = false;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'featured-collection-banner' && value.blocks) {
      const roles = new Set(['header', 'banner', 'product-list-banner']);
      const configured = value.block_order || [];
      const order = configured.filter((id) => value.blocks[id] && !value.blocks[id].static);
      for (const [id, block] of Object.entries(value.blocks)) {
        if (!roles.has(block.type)) continue;
        if (block.static) { delete block.static; changed = true; }
        if (!order.includes(id)) order.push(id);
      }
      if (JSON.stringify(configured) !== JSON.stringify(order)) {
        value.block_order = order;
        changed = true;
      }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(document);
  return changed;
}

function migrateFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const prefix = source.match(/^\s*\/\*[\s\S]*?\*\/\s*/)?.[0] || '';
  const document = JSON.parse(source.slice(prefix.length));
  if (!migrateFeaturedCollectionBanner(document)) return false;
  fs.writeFileSync(file, prefix + JSON.stringify(document, null, 2) + '\n');
  return true;
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('Pass saved template/group JSON files explicitly.');
  for (const file of files) console.log(`${migrateFile(path.resolve(file)) ? 'Migrated' : 'Unchanged'}: ${file}`);
}
module.exports = { migrateFeaturedCollectionBanner, migrateFile };
