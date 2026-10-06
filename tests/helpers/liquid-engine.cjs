const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Prefer a normal LiquidJS installation. Shopify CLI also ships LiquidJS in a
// CommonJS factory inside its ESM bundle; load only that factory, without CLI
// startup, credentials or network access. Override for another CLI installation.
function loadLiquid() {
  try { return require('liquidjs').Liquid; } catch {}
  const candidates = process.env.PATH.split(path.delimiter).map((directory) => path.join(directory, 'shopify'));
  const command = candidates.find((file) => fs.existsSync(file));
  if (!command) throw new Error('Install LiquidJS or Shopify CLI to run Liquid rendering tests.');
  const dist = process.env.SHOPIFY_CLI_DIST || path.resolve(path.dirname(fs.realpathSync(command)), '../dist');
  for (const file of fs.readdirSync(dist)) {
    if (!file.startsWith('chunk-') || !file.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(dist, file), 'utf8');
    if (!source.includes('[LiquidJS]')) continue;
    const factory = source.match(/var (\w+)=(\w+)\((\w+)=>\{"use strict";/);
    if (!factory) continue;
    const factoryStart = source.indexOf(factory[0]);
    const factoryEnd = source.indexOf('});', source.indexOf('.version=', factoryStart));
    if (factoryEnd < 0) continue;
    const context = { X: require, ye() {}, [factory[2]]: (initialize) => {
      let exports;
      return () => { if (!exports) { exports = {}; initialize(exports); } return exports; };
    } };
    vm.createContext(context);
    vm.runInContext(source.slice(factoryStart, factoryEnd + 3) + `;globalThis.Liquid=${factory[1]}().Liquid;`, context);
    return context.Liquid;
  }
  throw new Error('LiquidJS bundle not found. Install liquidjs or set SHOPIFY_CLI_DIST.');
}
function stripShopifyMetadata(source) {
  return source.replace(/{%\s*(doc|schema|stylesheet)\s*%}[\s\S]*?{%\s*end\1\s*%}/g, '');
}
module.exports = { loadLiquid, stripShopifyMetadata };
