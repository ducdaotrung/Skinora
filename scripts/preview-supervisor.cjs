#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BRANCH = 'codex/spinel-chieutt-dev';
const STORE = 'spinel-theme.myshopify.com';
const THEME = '144448127024';
const NAME = 'spinel-theme/codex/spinel-chieutt-dev';
const DIR = path.join(ROOT, '.shopify', 'preview-supervisor');
const LOCK = path.join(DIR, 'owner.json');
const LOG = path.join(DIR, 'preview.log');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

function command(file, args) {
  return execFileSync(file, args, { cwd: ROOT, encoding: 'utf8', timeout: 60000,
    env: cliEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function cliEnv() {
  // Explicit arguments must not inherit live/editor-sync flags from a shell.
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('SHOPIFY_FLAG_')) delete env[key];
  return env;
}

function assertBranch() {
  if (command('git', ['branch', '--show-current']) !== BRANCH) {
    throw new Error(`Chỉ được chạy trên branch ${BRANCH}`);
  }
}

function verifyTheme() {
  assertBranch();
  const info = JSON.parse(command('shopify', ['theme', 'info', '--store', STORE,
    '--theme', THEME, '--json']));
  const theme = info.theme;
  if (!theme || String(theme.id) !== THEME || theme.name !== NAME ||
      theme.role !== 'unpublished' || theme.shop !== STORE) {
    throw new Error('Theme không đúng ID/tên/store/role unpublished; từ chối chạy preview');
  }
  log(`Đã xác minh ${THEME} (${NAME}), unpublished, ${STORE}`);
}

function portOpen(port = 9292) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let done = false;
    const finish = value => { if (!done) { done = true; socket.destroy(); resolve(value); } };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}

function readOwner() {
  try { return JSON.parse(fs.readFileSync(LOCK, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function matches(pid, kind) {
  if (!alive(pid)) return false;
  const args = command('ps', ['-p', String(pid), '-o', 'command=']);
  if (kind === 'supervisor') return args.includes(__filename) && args.includes('run');
  return args.includes('theme dev') && args.includes(`--theme ${THEME}`) &&
    args.includes(`--store ${STORE}`) && args.includes(`--path ${ROOT}`);
}

async function killGroup(pid) {
  try { process.kill(-pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  // Give the entire owned process group time to clean up its listener.
  await sleep(1500);
  try { process.kill(-pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
}

// Exported state machine: tests drive real recovery decisions with a fake runtime.
async function supervise(runtime, timing = {}) {
  const { poll = 2000, startup = 120000, stable = 60000, base = 2000, max = 60000 } = timing;
  let backoff = base;
  while (!runtime.stopping()) {
    let child;
    let healthySince;
    try {
      await runtime.verify();
      if (runtime.stopping()) break;
      if (await runtime.portOpen()) throw new Error('Cổng 9292 đã bị process khác chiếm');
      child = runtime.start();
      const started = runtime.now();
      let misses = 0;
      while (!runtime.stopping()) {
        await runtime.guard();
        if (!runtime.alive(child)) throw new Error('Process theme dev đã thoát');
        if (await runtime.portOpen()) {
          misses = 0;
          if (healthySince === undefined) {
            healthySince = runtime.now();
            runtime.log('Preview đang nghe tại http://127.0.0.1:9292');
          }
          if (runtime.now() - healthySince >= stable) backoff = base;
        } else if (healthySince !== undefined) {
          if (++misses >= 2) throw new Error('Cổng 9292 mất kết nối qua 2 lần kiểm tra');
        } else if (runtime.now() - started >= startup) {
          throw new Error('Khởi động quá 120 giây nhưng cổng chưa mở');
        }
        await runtime.wait(poll);
      }
    } catch (error) {
      runtime.log(`Lỗi: ${error.message}`);
    } finally {
      if (child) await runtime.stop(child);
    }
    if (!runtime.stopping()) {
      runtime.log(`Thử khôi phục sau ${backoff / 1000} giây`);
      await runtime.wait(backoff);
      backoff = Math.min(backoff * 2, max);
    }
  }
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  assertBranch();
  // Exclusive create prevents two starts from owning the preview simultaneously.
  let lock;
  try { lock = fs.openSync(LOCK, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Only one contender may recover a stale lock. A concurrent fresh start
    // can still win the final exclusive create, in which case this run exits.
    const recovery = path.join(DIR, 'recovery.lock');
    const fd = fs.openSync(recovery, 'wx', 0o600);
    try {
      const owner = readOwner();
      if (owner && alive(owner.pid)) throw new Error(`Supervisor/process PID ${owner.pid} còn sống; dùng status/stop trước`);
      if (owner?.childPid && matches(owner.childPid, 'child')) {
        log(`Dọn process cũ thuộc supervisor: ${owner.childPid}`);
        await killGroup(owner.childPid);
      }
      if (owner) fs.unlinkSync(LOCK);
      lock = fs.openSync(LOCK, 'wx', 0o600);
    } finally { fs.closeSync(fd); fs.unlinkSync(recovery); }
  }
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, childPid: null }));
  fs.closeSync(lock);
  let stopping = false;
  const requestStop = () => { stopping = true; };
  process.on('SIGTERM', requestStop);
  process.on('SIGINT', requestStop);
  const save = childPid => fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, childPid }));
  const wait = async ms => {
    const until = Date.now() + ms;
    while (!stopping && Date.now() < until) await sleep(Math.min(250, until - Date.now()));
  };
  const guard = () => { try { assertBranch(); } catch (e) { stopping = true; throw e; } };
  try {
    await supervise({
      stopping: () => stopping, now: Date.now, wait, log,
      verify: () => { guard(); verifyTheme(); }, portOpen, guard,
      start: () => {
        const args = ['theme', 'dev', '--store', STORE, '--theme', THEME,
          '--path', ROOT, '--host', '127.0.0.1', '--port', '9292', '--nodelete'];
        log(`Chạy shopify ${args.join(' ')}`);
        const child = spawn('shopify', args, { cwd: ROOT, env: cliEnv(), detached: true,
          stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('error', error => { child.failed = true; log(error.message); });
        if (child.pid) save(child.pid);
        return child;
      },
      alive: child => !child.failed && child.exitCode === null && child.signalCode === null,
      stop: async child => { if (child.pid) await killGroup(child.pid); save(null); },
    });
  } finally {
    if (readOwner()?.pid === process.pid) fs.unlinkSync(LOCK);
    log('Supervisor đã dừng; không tự restart nữa');
  }
}

async function main(action) {
  if (action === 'run') return run();
  if (action === 'start') {
    assertBranch();
    fs.mkdirSync(DIR, { recursive: true });
    const owner = readOwner();
    if (owner && alive(owner.pid)) throw new Error(`Đã có process PID ${owner.pid}; dùng status`);
    const fd = fs.openSync(LOG, 'a', 0o600);
    const child = spawn(process.execPath, [__filename, 'run'], {
      cwd: ROOT, detached: true, stdio: ['ignore', fd, fd],
    });
    fs.closeSync(fd);
    child.unref();
    await sleep(750);
    if (readOwner()?.pid !== child.pid) throw new Error(`Không lấy được lock; xem ${LOG}`);
    log(`Supervisor PID ${child.pid}; log: ${LOG}`);
    return;
  }
  if (action === 'status') {
    const owner = readOwner();
    log(`Supervisor: ${owner && matches(owner.pid, 'supervisor') ? `PID ${owner.pid}` : 'đã dừng'}; child: ${owner?.childPid ?? 'none'}; cổng 9292: ${await portOpen() ? 'đang mở' : 'đang đóng'}`);
    log(`Log: ${LOG}`);
    return;
  }
  if (action === 'stop') {
    const owner = readOwner();
    if (owner && matches(owner.pid, 'supervisor')) {
      process.kill(owner.pid, 'SIGTERM');
      for (let i = 0; i < 40 && alive(owner.pid); i++) await sleep(250);
      if (alive(owner.pid)) throw new Error('Đang chờ Shopify info hoàn tất (timeout 60s); kiểm tra status/log');
    } else if (owner?.childPid && matches(owner.childPid, 'child')) {
      await killGroup(owner.childPid);
      fs.unlinkSync(LOCK);
    }
    log('Đã yêu cầu dừng supervisor và preview thuộc supervisor');
    return;
  }
  throw new Error('Dùng: node scripts/preview-supervisor.cjs start|run|status|stop');
}

if (require.main === module) main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { supervise, portOpen, cliEnv };
