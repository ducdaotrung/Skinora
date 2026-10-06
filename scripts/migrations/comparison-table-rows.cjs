const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const newId = () => randomUUID().replaceAll('-', '').slice(0, 12);

// Supports saved keyed block maps and schema preset arrays. Legacy settings
// stay stored for rollback, but row_mode prevents resurrection after deletion.
function migrateTable(table) {
  const children = Array.isArray(table.blocks) ? table.blocks : (table.block_order || Object.keys(table.blocks || {})).map((key) => table.blocks[key]).filter(Boolean);
  // Static blocks may be omitted from block_order; only columns use that order.
  const features = Object.values(table.blocks || {}).find((block) => block?.type === '_comparison-table-features');
  if (!features || features.settings?.row_mode === 'dynamic') return false;
  const columns = children.filter((block) => block.type === 'comparison-table-column');
  const keyed = !Array.isArray(table.blocks);
  const entries = keyed ? Object.entries(table.blocks) : children.map((block, index) => [block.id || `column-${index}`, block]);
  columns.forEach((column) => {
    column.settings ||= {};
    column.settings.column_key ||= entries.find(([, candidate]) => candidate === column)[0];
  });
  features.settings ||= {};
  const rows = [];
  for (let slot = 1; slot <= 16; slot += 1) {
    const label = features.settings[`feature_${slot}_label`] || '';
    const tooltip = features.settings[`feature_${slot}_tooltip`] || '';
    // Keep holes and tooltip-only entries when a later slot has content.
    rows.push({ type: 'comparison-table-row', settings: { label, tooltip }, blocks: columns.map((column) => ({
      type: 'comparison-table-row-value', settings: {
        column_key: column.settings.column_key,
        type: column.settings[`value_${slot}_type`] || 'none',
        text: column.settings[`value_${slot}_text`] || '',
      },
    })) });
  }
  while (rows.length && !rows.at(-1).settings.label && !rows.at(-1).settings.tooltip) rows.pop();
  if (keyed) {
    features.blocks = Object.fromEntries(rows.map((row, index) => {
      const key = newId();
      row.blocks = Object.fromEntries(row.blocks.map((value, valueIndex) => [newId(), value]));
      row.block_order = Object.keys(row.blocks);
      return [key, row];
    }));
    features.block_order = Object.keys(features.blocks);
  } else features.blocks = rows;
  features.settings.row_mode = 'dynamic';
  return true;
}

function migrate(document) {
  let changed = 0;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'comparison-table' && migrateTable(node)) changed += 1;
    Object.values(node).forEach(walk);
  }
  walk(document);
  return changed;
}

if (require.main === module) {
  for (const filename of process.argv.slice(2)) {
    const source = fs.readFileSync(filename, 'utf8');
    const match = source.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/);
    const body = match ? match[1] : source.replace(/^\s*\/\*[\s\S]*?\*\//, '');
    const document = JSON.parse(body);
    const changed = migrate(document);
    if (!changed) continue;
    const output = `${JSON.stringify(document, null, 2)}\n`;
    fs.writeFileSync(filename, match ? source.replace(match[0], `{% schema %}\n${output}{% endschema %}`) : source.slice(0, source.indexOf('{')) + output);
    process.stdout.write(`${path.basename(filename)}: migrated ${changed} table(s)\n`);
  }
}
module.exports = { migrate, migrateTable };
