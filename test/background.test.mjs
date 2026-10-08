// Loads the real service worker with a fake `chrome` API, a fake judge tab, and a fake GitHub.
// Checks the full path: tab tick -> Codeforces API -> source fetch through the tab -> commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeGitHub } from './fake-github.mjs';

function makeStorage() {
  const data = {};
  return {
    data,
    async get(key) { return key in data ? { [key]: structuredClone(data[key]) } : {}; },
    async set(obj) { for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v); },
  };
}

const listeners = { message: [], alarm: [], installed: [], startup: [] };
const sent = [];
const notifications = [];
const local = makeStorage();
const session = makeStorage();

// What the Codeforces tab answers. 1A is in the repo with the same code. 2B is new.
const cfStatus = {
  status: 'OK',
  result: [
    { id: 11, creationTimeSeconds: 1791427000, verdict: 'OK', programmingLanguage: 'C++17 (GCC 7-32)', problem: { contestId: 2, index: 'B', name: 'New One', rating: 1200 } },
    { id: 10, creationTimeSeconds: 1791426000, verdict: 'WRONG_ANSWER', programmingLanguage: 'C++17 (GCC 7-32)', problem: { contestId: 2, index: 'B', name: 'New One', rating: 1200 } },
    { id: 5, creationTimeSeconds: 1700000000, verdict: 'OK', programmingLanguage: 'GNU C11', problem: { contestId: 1, index: 'A', name: 'Old One', rating: 800 } },
  ],
};
const sources = { 5: 'old\r\n', 11: '\r\n#include <cstdio>\r\nint main(){}' };

globalThis.chrome = {
  storage: { local, session },
  runtime: {
    onMessage: { addListener: (f) => listeners.message.push(f) },
    onInstalled: { addListener: (f) => listeners.installed.push(f) },
    onStartup: { addListener: (f) => listeners.startup.push(f) },
    getURL: (p) => `chrome-extension://test/${p}`,
    openOptionsPage: () => {},
  },
  alarms: { create: () => {}, onAlarm: { addListener: (f) => listeners.alarm.push(f) } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  notifications: { create: (o) => notifications.push(o) },
  tabs: {
    query: async ({ url }) => (url.startsWith('https://codeforces.com') ? [{ id: 7, status: 'complete' }] : []),
    sendMessage: async (tabId, msg) => {
      sent.push({ tabId, ...msg });
      assert.equal(msg.type, 'ac-commit:fetch');
      if (msg.url.includes('/api/user.status')) return { ok: true, status: 200, text: JSON.stringify(cfStatus) };
      if (msg.url.includes('/data/submitSource')) {
        assert.equal(msg.method, 'POST');
        assert.equal(msg.csrf, true);
        const id = msg.body.replace('submissionId=', '');
        return { ok: true, status: 200, text: JSON.stringify({ source: sources[id] }) };
      }
      return { ok: true, status: 404, text: 'not found' };
    },
  },
};

const gh = fakeGitHub({ files: { 'README.md': '# Codeforces solutions\n', 'codeforces/1/A.c': 'old\n' } });
globalThis.fetch = gh.fetchImpl;

await local.set({
  settings: {
    token: 'test-token', owner: 'someone', authorName: 'Some One', authorEmail: '42+someone@users.noreply.github.com',
    platforms: { codeforces: { handle: 'someone' }, leetcode: { enabled: false }, codechef: { enabled: false } },
  },
});
await import('../src/background.js');

const send = (msg, sender = {}) => new Promise((resolve) => {
  const async = listeners.message[0](msg, sender, resolve);
  if (!async) resolve();
});
const tick = (url) => send({ type: 'ac-commit:tick', platform: 'codeforces', url, changed: true }, { tab: { id: 7 } });

async function until(cond, ms = 3000) {
  const end = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

test('a Codeforces tab tick pushes the new AC as one dated commit', async () => {
  tick('https://codeforces.com/contest/2/problem/B');
  await until(async () => (await local.get('state')).state?.codeforces?.lastCheck);
  const { state } = await local.get('state');
  assert.equal(state.codeforces.error, null);
  assert.equal(state.codeforces.solved, 2);
  assert.equal(gh.state.commits.length, 1, '1A already has the same code');
  const c = gh.state.commits[0];
  assert.equal(c.message, 'CF 2B: New One');
  assert.equal(c.author.name, 'Some One');
  assert.equal(c.author.email, '42+someone@users.noreply.github.com');
  assert.equal(c.author.date, new Date(1791427000 * 1000).toISOString());
  assert.equal(gh.state.files['codeforces/2/B.cpp'], '\n#include <cstdio>\nint main(){}\n');
  assert.match(gh.state.files['README.md'], /^# Codeforces solutions\n\n## Codeforces\n\nProfile: \[someone\]/);
  assert.match(gh.state.files['README.md'], /<!-- ac-commit:codeforces:start -->\nSolved: \*\*1\*\*/);
  assert.match(gh.state.files['README.md'], /\| \[2B\]\(https:\/\/codeforces\.com\/contest\/2\/problem\/B\) \| New One \| 1200 \| \[C\+\+\]\(codeforces\/2\/B\.cpp\) \|/);
  assert.equal(notifications.length, 1);
  assert.deepEqual((await local.get('synced:codeforces'))['synced:codeforces'].subs, { '1/A': '5', '2/B': '11' });
});

test('ticks are throttled, and an unchanged judge does not touch GitHub', async () => {
  const before = sent.length;
  await tick('https://codeforces.com/contest/2/problem/B');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(sent.length, before, 'second tick inside 20 s should not sync');

  const { ticks } = await session.get('ticks');
  ticks.codeforces.lastRun = 0;
  await session.set({ ticks });
  const checked = (await local.get('state')).state.codeforces.lastCheck;
  const ghCalls = gh.state.calls.length;
  tick('https://codeforces.com/contest/2/problem/B');
  await until(async () => (await local.get('state')).state.codeforces.lastCheck !== checked);
  assert.equal(gh.state.calls.length, ghCalls);
  assert.ok(!sent.slice(before).some((m) => m.url.includes('submitSource')));
});

test('a newer AC on the judge updates the stored file', async () => {
  cfStatus.result.unshift({ id: 12, creationTimeSeconds: 1791428000, verdict: 'OK', programmingLanguage: 'C++17 (GCC 7-32)', problem: { contestId: 2, index: 'B', name: 'New One', rating: 1200 } });
  sources[12] = 'int main(){return 0;}';
  const { ticks } = await session.get('ticks');
  ticks.codeforces.lastRun = 0;
  await session.set({ ticks });
  tick('https://codeforces.com/contest/2/my');
  await until(async () => gh.state.commits.length === 2);
  assert.equal(gh.state.commits[1].message, 'CF 2B: New One (new AC)');
  assert.equal(gh.state.files['codeforces/2/B.cpp'], 'int main(){return 0;}\n');
});

test('Save and check fills in the account and sets up repos', async () => {
  const s = (await local.get('settings')).settings;
  s.owner = '';
  s.authorName = '';
  s.authorEmail = '';
  await local.set({ settings: s });
  const res = await send({ type: 'ac-commit:test' });
  assert.equal(res.github.ok, true);
  assert.equal(res.codeforces.ok, true, res.codeforces.message);
  const saved = (await local.get('settings')).settings;
  assert.equal(saved.owner, 'someone');
  assert.equal(saved.authorEmail, '42+someone@users.noreply.github.com');
});
