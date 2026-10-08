import { loadSettings } from './settings.js';
import { syncPlatform } from './sync.js';
import { fetchNet, checkResponse } from './net.js';
import { Repo, whoAmI } from './github.js';
import { templateReadme } from './readme.js';
import codeforces from './platforms/codeforces.js';
import leetcode from './platforms/leetcode.js';
import codechef from './platforms/codechef.js';

const PLATFORMS = { codeforces, leetcode, codechef };
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
// How often a judge tab may trigger a check: right after a submit, on problem pages, elsewhere.
const INTERVAL = { pending: 8 * 1000, hot: 20 * 1000, idle: 90 * 1000 };
// LeetCode opens /submissions/<id>/ after a submit. Codeforces and CodeChef report pending verdicts instead.
const SUBMIT_URL = { leetcode: /\/submissions\/\d+/ };
const RETRY_AFTER = 30 * MIN;

const running = new Set();
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Fetches through the judge tab, so requests carry the session cookies and pass Cloudflare.
function tabNet(tabId) {
  const text = async (url, opts = {}) => {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'ac-commit:fetch', url, ...opts });
    if (!r) throw new Error('The judge tab did not answer. Reload the tab.');
    if (!r.ok) throw new Error(r.error);
    return checkResponse(url, r.status, r.text);
  };
  return { text, json: async (url, opts) => JSON.parse(await text(url, opts)) };
}

async function findTab(platform) {
  const tabs = await chrome.tabs.query({ url: `${platform.origin}/*` });
  return tabs.find((t) => t.status === 'complete' && !t.discarded) || null;
}

async function getLocal(key, fallback) {
  return (await chrome.storage.local.get(key))[key] ?? fallback;
}

async function updateState(id, patch) {
  const state = await getLocal('state', {});
  state[id] = { ...(state[id] || {}), ...patch };
  await chrome.storage.local.set({ state });
  await updateBadge(state);
  return state[id];
}

async function updateBadge(state) {
  const failing = Object.values(state).some((s) => s.error);
  await chrome.action.setBadgeText({ text: failing ? '!' : '' });
  if (failing) await chrome.action.setBadgeBackgroundColor({ color: '#cf222e' });
}

async function notify(title, message) {
  const settings = await loadSettings();
  if (!settings.notify) return;
  chrome.notifications.create({ type: 'basic', iconUrl: chrome.runtime.getURL('icons/128.png'), title, message });
}

export async function run(id, { tabId, forceFull = false } = {}) {
  const platform = PLATFORMS[id];
  if (!platform || running.has(id)) return null;
  const settings = await loadSettings();
  const cfg = settings.platforms[id];
  if (!cfg.enabled || !cfg.repo || (platform.needsHandle && !cfg.handle)) return null;
  if (!settings.token || !settings.owner) {
    await updateState(id, { error: 'Add a GitHub token in AC Commit settings and click Save.' });
    return null;
  }

  let net;
  if (platform.needsTab) {
    const tab = tabId ?? (await findTab(platform))?.id;
    if (tab == null) return null; // Runs again when a judge tab is open.
    net = tabNet(tab);
  } else {
    net = fetchNet();
  }

  running.add(id);
  const now = Date.now();
  const state = (await getLocal('state', {}))[id] || {};
  const storeKey = `synced:${id}`;
  const target = `${settings.owner}/${cfg.repo}@${cfg.handle}`;
  let stored = await getLocal(storeKey, null);
  if (!stored || stored.target !== target) stored = { target, subs: {}, failed: {} };
  const synced = new Map(Object.entries(stored.subs));
  const save = () => chrome.storage.local.set({ [storeKey]: { ...stored, subs: Object.fromEntries(synced) } });
  const full = forceFull || !state.lastFull || now - state.lastFull > DAY || state.target !== target;

  try {
    const res = await syncPlatform(platform, {
      net, cfg, settings, synced, full, timeZone,
      shouldTry: (item) => !(stored.failed[item.key] > now - RETRY_AFTER),
      onItemError: (item) => { stored.failed[item.key] = now; },
      onPushed: async (sol, _sha, item) => {
        delete stored.failed[item.key];
        await save();
        await updateState(id, { lastPushed: { message: sol.message, at: Date.now() } });
        await notify('Pushed to GitHub', sol.message);
      },
    });
    await save();
    const error = res.errors.length ? `${res.errors.length} problem(s) failed: ${res.errors[0].message}` : null;
    await updateState(id, {
      target, lastCheck: now, ...(full ? { lastFull: now, solved: res.total } : {}), error,
      pushedTotal: (state.pushedTotal || 0) + res.pushed.length,
    });
    if (res.pending) await setTicks(id, { pendingUntil: Date.now() + 2 * MIN });
    return res;
  } catch (err) {
    await save();
    await updateState(id, { lastCheck: now, error: err.message });
    return null;
  } finally {
    running.delete(id);
  }
}

async function getTicks() {
  return (await chrome.storage.session.get('ticks')).ticks || {};
}

async function setTicks(id, patch) {
  const ticks = await getTicks();
  ticks[id] = { ...(ticks[id] || {}), ...patch };
  await chrome.storage.session.set({ ticks });
  return ticks[id];
}

async function onTick({ platform: id, url, changed }, tab) {
  const platform = PLATFORMS[id];
  if (!platform || !tab) return;
  const now = Date.now();
  let t = (await getTicks())[id] || {};
  if (changed && SUBMIT_URL[id]?.test(url)) t = await setTicks(id, { pendingUntil: now + 2 * MIN });
  const interval = t.pendingUntil > now ? INTERVAL.pending
    : platform.hotUrl.test(new URL(url).pathname) ? INTERVAL.hot : INTERVAL.idle;
  if (now - (t.lastRun || 0) < interval) return;
  await setTicks(id, { lastRun: now });
  await run(id, { tabId: tab.id });
}

async function syncAll({ forceFull = false } = {}) {
  const results = {};
  for (const id of Object.keys(PLATFORMS)) results[id] = await run(id, { forceFull });
  return results;
}

// Checks the token, fills in owner and author, and makes sure each repo exists.
// An empty repo gets its README here, so the first AC lands on a normal branch.
async function testRepos() {
  const settings = await loadSettings();
  const out = {};
  if (!settings.token) return { github: { ok: false, message: 'Paste a token first.' } };
  try {
    const me = await whoAmI(settings.token);
    settings.owner ||= me.login;
    settings.authorName ||= me.name;
    settings.authorEmail ||= me.email;
    await chrome.storage.local.set({ settings });
    out.github = { ok: true, message: `Token works for ${me.login}. Commits are authored as ${settings.authorName} <${settings.authorEmail}>.` };
  } catch (err) {
    return { github: { ok: false, message: err.message } };
  }
  for (const [id, cfg] of Object.entries(settings.platforms)) {
    if (!cfg.enabled) continue;
    const platform = PLATFORMS[id];
    if (platform.needsHandle && !cfg.handle) {
      out[id] = { ok: false, message: 'Enter your handle.' };
      continue;
    }
    try {
      const repo = new Repo({ token: settings.token, owner: settings.owner, repo: cfg.repo, branch: settings.branch });
      await repo.load({ initialReadme: templateReadme(platform, cfg.handle) });
      out[id] = { ok: true, message: `${settings.owner}/${cfg.repo}: ready, ${repo.paths.size} files.` };
    } catch (err) {
      out[id] = { ok: false, message: err.message };
    }
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'ac-commit:tick') {
    onTick(msg, sender.tab).catch(() => {});
    return false;
  }
  if (msg?.type === 'ac-commit:sync-now') {
    syncAll({ forceFull: true }).then(reply, (err) => reply({ error: err.message }));
    return true;
  }
  if (msg?.type === 'ac-commit:test') {
    testRepos().then(reply, (err) => reply({ error: { ok: false, message: err.message } }));
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ac-commit') syncAll().catch(() => {});
});

function setup() {
  chrome.alarms.create('ac-commit', { periodInMinutes: 30, delayInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener((details) => {
  setup();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(setup);
