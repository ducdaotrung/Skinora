const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/gift-card.js', 'utf8');
function fixture({ denied = false, legacy = false } = {}) {
  let click, copiedValue, selected = false, input;
  const button = { hidden: true, textContent: 'Copy code', dataset: { code: 'sample-unformatted', copied: 'Code copied', error: 'Copy unavailable' }, addEventListener: (_, fn) => { click = fn; }, focus() {} };
  const status = { textContent: '' };
  const qr = { dataset: { identifier: 'sample-native-qr' }, hidden: true, removeAttribute() {}, querySelector: () => null };
  const code = { focus() { selected = true; } };
  const root = { querySelector: (selector) => ({ '[data-gift-card-qr]': qr, '[data-gift-card-copy]': button, '[data-gift-card-status]': status, '#GiftCardCode': code })[selector] };
  const document = { querySelector: () => root, body: { appendChild() {} }, createElement: () => (input = { style: {}, setAttribute() {}, select() {}, remove() {} }), execCommand: () => { if (legacy) copiedValue = input.value; return legacy; }, createRange: () => ({ selectNodeContents() {} }) };
  let qrPayload;
  vm.runInNewContext(source, { document, navigator: { clipboard: { writeText: async value => { if (denied) throw Error('Permission denied'); copiedValue = value; } } }, window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) }, QRCode: function(_, options) { qrPayload = options; }, setTimeout: () => 1, clearTimeout() {} });
  return { click, button, status, qr, qrPayload, copied: () => copiedValue, selected: () => selected };
}
test('native QR uses redemption identifier and 120px dimensions', () => { const f = fixture(); assert.equal(f.qr.hidden, false); assert.deepEqual(JSON.parse(JSON.stringify(f.qrPayload)), { text: 'sample-native-qr', width: 120, height: 120 }); });
test('Clipboard API copies exact unformatted code and announces success', async () => { const f = fixture(); await f.click(); assert.equal(f.copied(), 'sample-unformatted'); assert.equal(f.status.textContent, 'Code copied'); });
test('denied Clipboard API falls back to exact unformatted legacy copy', async () => { const f = fixture({ denied: true, legacy: true }); await f.click(); assert.equal(f.copied(), 'sample-unformatted'); assert.equal(f.button.textContent, 'Code copied'); });
test('failed clipboard paths select code and report error without claiming success', async () => { const f = fixture({ denied: true }); await f.click(); assert.equal(f.selected(), true); assert.equal(f.button.textContent, 'Copy code'); assert.equal(f.status.textContent, 'Copy unavailable'); });
