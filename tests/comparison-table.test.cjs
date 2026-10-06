const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { migrate } = require('../scripts/migrations/comparison-table-rows.cjs');
const source = fs.readFileSync(require.resolve('../assets/comparison-table.js'), 'utf8');

function fixture() {
  const definitions = new Map();
  const observers = [];
  class Element {
    constructor() { this.attributes = {}; this.style = { setProperty: (key, value) => this.attributes[key] = value }; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
  }
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const context = vm.createContext({ HTMLElement: Element, MutationObserver: Observer, AbortController,
    window: {}, customElements: { get: (key) => definitions.get(key), define: (key, value) => definitions.set(key, value) } });
  vm.runInContext(source, context);
  const row = (index, label = '') => Object.assign(new Element(), { dataset: { comparisonTableRow: String(index), comparisonTableFeatureLabel: label } });
  function table(labels) {
    const element = new (definitions.get('comparison-table-rows'))();
    const feature = labels.map((label, index) => row(index + 1, label));
    const cells = labels.map((_, index) => row(index + 1));
    const grid = new Element();
    grid.querySelectorAll = (selector) => selector.includes('col--feature') ? feature : [...feature, ...cells];
    element.querySelector = () => grid;
    element.connectedCallback();
    return { element, feature, cells, grid, observer: observers.at(-1) };
  }
  return { context, table, row, definitions, observers };
}

test('classic asset executes repeatedly without redeclaration or replacing definitions', () => {
  const f = fixture();
  const definition = f.definitions.get('comparison-table-rows');
  vm.runInContext(source, f.context);
  assert.equal(f.definitions.get('comparison-table-rows'), definition);
});

test('instances independently update tracks, ARIA and row visibility after replacement and reconnect', () => {
  const f = fixture();
  const a = f.table(['One', '', 'Three', '']);
  const b = f.table(['Only', '', '', '']);
  assert.equal(a.grid.attributes['aria-rowcount'], '4');
  assert.equal(b.grid.attributes['aria-rowcount'], '2');
  assert.equal(a.cells[3].hidden, true);
  assert.equal(a.cells[3].attributes['aria-rowindex'], undefined);
  a.feature[2].dataset.comparisonTableFeatureLabel = '';
  a.observer.callback();
  assert.equal(a.element.attributes['--comparison-table-track-count'], '2');
  assert.equal(b.element.attributes['--comparison-table-track-count'], '2');
  a.feature[3].dataset.comparisonTableFeatureLabel = 'Added';
  a.observer.callback();
  assert.equal(a.cells[3].hidden, false);
  assert.equal(a.cells[3].attributes['aria-rowindex'], '5');
  a.element.connectedCallback();
  assert.equal(f.observers.length, 2);
  a.element.disconnectedCallback();
  assert.equal(a.observer.disconnected, true);
  a.element.connectedCallback();
  assert.equal(f.observers.length, 3);
});

test('migration preserves stable column mapping and legacy data and is idempotent', () => {
  const table = { type: 'comparison-table', block_order: ['features', 'second', 'first'], blocks: {
    features: { type: '_comparison-table-features', static: true, settings: { feature_1_label: 'Speed', feature_3_label: 'Price', feature_3_tooltip: 'Details' } },
    first: { type: 'comparison-table-column', settings: { value_1_type: 'text', value_1_text: '10', value_3_type: 'no' } },
    second: { type: 'comparison-table-column', settings: { value_1_type: 'yes', value_3_type: 'text', value_3_text: '$20' } },
  } };
  const document = { table };
  assert.equal(migrate(document), 1);
  const features = table.blocks.features;
  const rows = features.block_order.map((key) => features.blocks[key]);
  assert.deepEqual(rows.map((row) => row.settings.label), ['Speed', '', 'Price']);
  assert.equal(rows[2].settings.tooltip, 'Details');
  const values = Object.values(rows[0].blocks);
  assert.deepEqual(values.map((value) => value.settings.column_key), ['second', 'first']);
  assert.equal(values[1].settings.text, '10');
  assert.equal(table.blocks.first.settings.value_1_text, '10');
  const saved = JSON.stringify(document);
  assert.equal(migrate(document), 0);
  assert.equal(JSON.stringify(document), saved);
  features.block_order.reverse();
  table.block_order.reverse();
  assert.equal(rows[0].blocks[rows[0].block_order[1]].settings.column_key, 'first');
  features.blocks = {};
  features.block_order = [];
  assert.equal(features.settings.row_mode, 'dynamic');
});

test('migration finds static features outside block_order and retains ordered columns', () => {
  const features = { type: '_comparison-table-features', id: 'static-features', static: true,
    settings: { feature_1_label: 'Speed', feature_3_label: 'Price', feature_3_tooltip: 'Details', heading: 'Features' } };
  const table = { type: 'comparison-table', block_order: ['second', 'missing', 'first'], blocks: {
    first: { type: 'comparison-table-column', settings: { value_1_type: 'text', value_1_text: '10', value_3_type: 'no' } },
    features,
    second: { type: 'comparison-table-column', settings: { column_key: 'saved-second', value_1_type: 'yes', value_3_type: 'text', value_3_text: '$20' } },
    unordered: { type: 'comparison-table-column', settings: { value_1_type: 'text', value_1_text: 'Not rendered' } },
  } };
  const document = { sections: { comparison: { blocks: { table } } } };
  assert.equal(migrate(document), 1);
  assert.equal(table.blocks.features, features);
  assert.equal(features.id, 'static-features');
  assert.equal(features.static, true);
  assert.equal(features.settings.heading, 'Features');
  assert.equal(features.settings.feature_1_label, 'Speed');
  assert.equal(features.settings.row_mode, 'dynamic');
  assert.deepEqual(table.block_order, ['second', 'missing', 'first']);
  const rows = features.block_order.map((key) => features.blocks[key]);
  assert.deepEqual(rows.map((row) => row.settings), [
    { label: 'Speed', tooltip: '' }, { label: '', tooltip: '' }, { label: 'Price', tooltip: 'Details' },
  ]);
  const values = rows.map((row) => row.block_order.map((key) => row.blocks[key].settings));
  assert.deepEqual(values, [
    [{ column_key: 'saved-second', type: 'yes', text: '' }, { column_key: 'first', type: 'text', text: '10' }],
    [{ column_key: 'saved-second', type: 'none', text: '' }, { column_key: 'first', type: 'none', text: '' }],
    [{ column_key: 'saved-second', type: 'text', text: '$20' }, { column_key: 'first', type: 'no', text: '' }],
  ]);
  assert.equal(table.blocks.unordered.settings.column_key, undefined);
  const saved = JSON.stringify(document);
  assert.equal(migrate(document), 0);
  assert.equal(JSON.stringify(document), saved);
});

test('shipped presets use dynamic rows and every value maps to a declared column', () => {
  for (const filename of ['blocks/comparison-table.liquid', 'sections/comparison-table-custom.liquid']) {
    const liquid = fs.readFileSync(require.resolve(`../${filename}`), 'utf8');
    const schema = JSON.parse(liquid.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/)[1]);
    for (const preset of schema.presets) {
      const tables = filename.startsWith('blocks/') ? [preset] : preset.blocks.filter((block) => block.type === 'comparison-table');
      for (const table of tables) {
        const features = table.blocks.find((block) => block.type === '_comparison-table-features');
        assert.equal(features.settings.row_mode, 'dynamic');
        const keys = new Set(table.blocks.filter((block) => block.type === 'comparison-table-column').map((block) => block.settings.column_key));
        assert.ok(features.blocks.length > 0);
        for (const row of features.blocks) {
          assert.equal(row.type, 'comparison-table-row');
          for (const value of row.blocks) assert.ok(keys.has(value.settings.column_key));
        }
      }
    }
  }
});
