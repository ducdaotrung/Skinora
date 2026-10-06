'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { supervise, portOpen, cliEnv } = require('../scripts/preview-supervisor.cjs');

function fake(overrides = {}) {
  const state = { time: 0, stopped: false, starts: 0, stops: 0, waits: [], messages: [] };
  const runtime = {
    stopping: () => state.stopped, now: () => state.time,
    wait: async ms => { state.waits.push(ms); state.time += ms; },
    log: message => state.messages.push(message), verify: async () => {}, guard: async () => {},
    portOpen: async () => false, alive: () => false,
    start: () => { state.starts++; return {}; },
    stop: async () => { state.stops++; if (state.stops === 3) state.stopped = true; },
    ...overrides,
  };
  return { state, runtime };
}

test('process crash cleans each child and backs off before restarting', async () => {
  const { state, runtime } = fake();
  await supervise(runtime);
  assert.equal(state.starts, 3);
  assert.equal(state.stops, 3);
  assert.deepEqual(state.waits, [2000, 4000]);
});

test('occupied port never spawns or kills another process', async () => {
  const { state, runtime } = fake({ portOpen: async () => true });
  runtime.wait = async () => { state.stopped = true; };
  await supervise(runtime);
  assert.equal(state.starts, 0);
  assert.equal(state.stops, 0);
  assert.match(state.messages[0], /process khác/);
});

test('unsafe target or failed info cannot start dev; backoff is bounded', async () => {
  const { state, runtime } = fake({ verify: async () => { throw new Error('wrong theme'); } });
  runtime.wait = async ms => { state.waits.push(ms); if (state.waits.length === 8) state.stopped = true; };
  await supervise(runtime);
  assert.equal(state.starts, 0);
  assert.deepEqual(state.waits, [2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
});

test('lost listener restarts after two misses; stable service resets backoff', async () => {
  const { state, runtime } = fake({ alive: () => true });
  runtime.portOpen = async () => state.starts === 0 ? false : state.time < 8;
  runtime.stop = async () => { state.stops++; };
  runtime.wait = async ms => {
    state.waits.push(ms); state.time += ms;
    if (state.stops) state.stopped = true;
  };
  await supervise(runtime, { poll: 2, stable: 4, base: 10 });
  assert.equal(state.stops, 1);
  assert.equal(state.time, 20);
  assert.match(state.messages.at(-2), /2 lần/);
});

test('startup timeout cleans child; user stop suppresses restart', async () => {
  const { state, runtime } = fake({ alive: () => true });
  runtime.stop = async () => { state.stops++; state.stopped = true; };
  await supervise(runtime, { poll: 2, startup: 6 });
  assert.equal(state.time, 6);
  assert.equal(state.stops, 1);
  assert.match(state.messages[0], /Khởi động/);
});

test('a single missed probe does not restart; explicit stop cleans the child', async () => {
  const { state, runtime } = fake({ alive: () => true });
  runtime.portOpen = async () => state.starts > 0 && state.time !== 2;
  runtime.wait = async ms => { state.time += ms; if (state.time >= 8) state.stopped = true; };
  await supervise(runtime, { poll: 2 });
  assert.equal(state.starts, 1);
  assert.equal(state.stops, 1);
  assert.equal(state.messages.some(message => message.startsWith('Lỗi:')), false);
});

test('branch guard stops and cleans the preview without restart', async () => {
  const { state, runtime } = fake({ alive: () => true });
  runtime.guard = async () => { state.stopped = true; throw new Error('branch changed'); };
  await supervise(runtime);
  assert.equal(state.starts, 1);
  assert.equal(state.stops, 1);
  assert.deepEqual(state.waits, []);
});

test('TCP probe distinguishes open and closed ports', async () => {
  const server = net.createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try { assert.equal(await portOpen(port), true); }
  finally { await new Promise(resolve => server.close(resolve)); }
  assert.equal(await portOpen(port), false);
});

test('CLI environment removes inherited flag overrides', () => {
  process.env.SHOPIFY_FLAG_ALLOW_LIVE = 'true';
  try { assert.equal(cliEnv().SHOPIFY_FLAG_ALLOW_LIVE, undefined); }
  finally { delete process.env.SHOPIFY_FLAG_ALLOW_LIVE; }
});
