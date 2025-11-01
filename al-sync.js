#!/usr/bin/env node
// al-sync.js — Watch local files and upload to Adventure Land code slots via API.
// Matches the browser's "arguments=" payload style you captured.
// Node 18+ required.
// deps: chokidar, dotenv, minimist, p-retry, undici

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import chokidar from 'chokidar';
import minimist from 'minimist';
import pRetry from 'p-retry';
import { fetch } from 'undici';

const argv = minimist(process.argv.slice(2));
const ROOT = process.cwd();
const CONFIG_PATH = path.resolve(ROOT, 'al-sync.config.json');

const AUTH = process.env.AL_AUTH?.trim();
const BASE = (process.env.AL_BASE || 'https://adventure.land').replace(/\/+$/,'');
const SAVE_PATH = (process.env.AL_SAVE_PATH || '/api/save_code').replace(/^\/*/, '/');
const VERIFY_PATH = (process.env.AL_VERIFY_PATH || '/api/load_code').replace(/^\/*/, '/');

if (!AUTH) {
  console.error('❌ AL_AUTH missing. Put your auth cookie value in .env (from the adventure.land "auth" cookie).');
  process.exit(1);
}

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const loadConfig = async () => {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  const cfg = JSON.parse(raw);
  if (!Array.isArray(cfg.mappings) || cfg.mappings.length === 0) {
    throw new Error('No mappings defined in al-sync.config.json');
  }
  return {
    debounceMs: Math.max(0, cfg.debounceMs ?? 150),
    mappings: cfg.mappings.map(m => ({
      file: path.resolve(ROOT, m.file),
      name: String(m.name),
      slot: Number(m.slot)
    }))
  };
};

async function httpText(url, init, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), cookie: `auth=${AUTH}` },
      signal: controller.signal
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, text };
  } finally {
    clearTimeout(t);
  }
}

// ---------- SAVE (arguments-style) ----------
async function uploadCode({ name, slot, code }) {
  const url = `${BASE}${SAVE_PATH}`;
  // Exactly like your capture: form-encoded with method + arguments JSON
  const args = {
    code: String(code),
    slot: String(slot),
    name: String(name),
    log: 1
  };
  const form = new URLSearchParams();
  form.set('method', 'save_code');
  form.set('arguments', JSON.stringify(args));

  const { ok, status, statusText, text } = await httpText(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'referer': BASE // harmless; some setups log it
    },
    body: form.toString()
  });

  if (!ok) throw new Error(`HTTP ${status} ${statusText}: ${text || '<empty>'}`);
  // Many servers reply with JSON (success-ish), some with "ok"
  try {
    const j = JSON.parse(text);
    if (j?.message?.toLowerCase?.().includes('not found')) {
      throw new Error(`Server says "Not Found" (save): ${text.slice(0,160)}`);
    }
  } catch { /* plain text ok */ }

  return text;
}

// ---------- VERIFY (arguments-style, by slot number) ----------
async function verifyCode({ slot }) {
  const url = `${BASE}${VERIFY_PATH}`;
  const args = {
    // On your server "name" is the *slot number string* on load
    name: String(slot),
    run: "",
    log: 1
  };
  const form = new URLSearchParams();
  form.set('method', 'load_code');
  form.set('arguments', JSON.stringify(args));

  const { ok, status, statusText, text } = await httpText(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'referer': BASE
    },
    body: form.toString()
  });

  if (!ok) return null;

  // Try to extract code from likely shapes
  try {
    const j = JSON.parse(text);
    if (typeof j === 'string') return j;
    if (j && typeof j.code === 'string') return j.code;
    if (Array.isArray(j)) {
      const withCode = j.find(x => x && typeof x.code === 'string');
      if (withCode) return withCode.code;
    }
    // sometimes { result: { code: "..." } }
    if (j?.result?.code) return j.result.code;
  } catch { /* ignore */ }

  return null;
}

// ---------- Debounce & state ----------
function debounce(fn, ms) {
  let t; let lastArgs;
  return (...args) => {
    lastArgs = args;
    clearTimeout(t);
    t = setTimeout(() => fn(...lastArgs), ms);
  };
}

const state = new Map(); // filePath -> { lastHash }

// ---------- Sync ----------
async function syncOne(map) {
  const { file, name, slot } = map;
  const src = await fs.readFile(file, 'utf8');
  const srcHash = hash(src);
  const s = state.get(file) || {};
  if (s.lastHash === srcHash && !argv.once) return; // no change

  const op = async () => {
    await uploadCode({ name, slot, code: src });
    state.set(file, { lastHash: srcHash });
    console.log(`✅ Uploaded "${name}" to slot ${slot} (${path.basename(file)})`);

    // Verify (optional but helpful)
    const serverCode = await verifyCode({ slot }).catch(() => null);
    if (serverCode == null) {
      console.log('   (Verification skipped or unavailable)');
    } else {
      const same = serverCode === src;
      console.log(`   Verify: ${same ? '✔ match' : '✖ differs'}`);
      if (!same) {
        console.log(`   Server sample: ${serverCode.slice(0, 120)}${serverCode.length > 120 ? '…' : ''}`);
      }
    }
  };

  await pRetry(op, {
    retries: 5,
    factor: 1.8,
    minTimeout: 400,
    maxTimeout: 5000,
    onFailedAttempt: e => {
      console.warn(`   Retry ${e.attemptNumber}/5 for ${name} (slot ${slot}): ${e.message}`);
    }
  });
}

// ---------- Main ----------
async function main() {
  const cfg = await loadConfig();

  if (argv.once) {
    for (const m of cfg.mappings) {
      try {
        await syncOne(m);
      } catch (err) {
        console.error(`❌ Upload failed for ${m.name}: ${err.message}`);
      }
    }
    return;
  }

  // preload hashes so first upload only happens on actual change
  for (const m of cfg.mappings) {
    try {
      const src = await fs.readFile(m.file, 'utf8');
      state.set(m.file, { lastHash: hash(src) });
    } catch { /* file may not exist yet */ }
  }

  const byFile = new Map(cfg.mappings.map(m => [m.file, m]));
  const debounced = debounce((filePath) => {
    const m = byFile.get(filePath);
    if (m) syncOne(m).catch(err => console.error(`❌ Upload failed for ${m.name}: ${err.message}`));
  }, cfg.debounceMs);

  const watcher = chokidar.watch([...byFile.keys()], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: cfg.debounceMs, pollInterval: 50 }
  });

  console.log(`👀 Watching ${byFile.size} file(s) on ${BASE}${SAVE_PATH}`);
  console.log(`🔎 Verify via ${BASE}${VERIFY_PATH}`);
  for (const m of cfg.mappings) {
    console.log(` • ${m.file}  →  name "${m.name}", slot ${m.slot}`);
  }

  watcher.on('change', debounced);
  watcher.on('add', debounced);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
