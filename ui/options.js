import { loadSettings } from '../src/settings.js';

const NAMES = { codeforces: 'Codeforces', leetcode: 'LeetCode', codechef: 'CodeChef', github: 'GitHub' };
const PLACEHOLDER = { codeforces: 'your handle', leetcode: 'optional', codechef: 'your handle' };
const $ = (id) => document.getElementById(id);
const FIELDS = ['token', 'owner', 'branch', 'authorName', 'authorEmail'];

const tokenUrl = new URL('https://github.com/settings/personal-access-tokens/new');
tokenUrl.search = new URLSearchParams({
  name: 'AC Commit',
  description: 'Pushes accepted solutions from the AC Commit browser extension',
  expires_in: '366',
  contents: 'write',
}).toString();
$('new-token').href = tokenUrl.href;

function createLinks(s) {
  const links = Object.entries(s.platforms)
    .filter(([, p]) => p.enabled && p.repo)
    .map(([id, p]) => {
      const a = document.createElement('a');
      const url = new URL('https://github.com/new');
      url.search = new URLSearchParams({
        name: p.repo,
        description: `My accepted ${NAMES[id]} solutions, one commit per AC`,
        visibility: 'public',
      }).toString();
      a.href = url.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = p.repo;
      return a;
    });
  const out = [];
  links.forEach((a, i) => { if (i) out.push(', '); out.push(a); });
  $('create-links').replaceChildren(...out);
}

async function render() {
  const s = await loadSettings();
  for (const f of FIELDS) $(f).value = s[f];
  $('notify').checked = s.notify;
  $('platforms').replaceChildren(
    ...Object.entries(s.platforms).map(([id, p]) => {
      const row = document.createElement('div');
      row.className = 'grid';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <label class="row" style="margin:0;font-weight:600"><input type="checkbox" data-id="${id}" data-k="enabled"> ${NAMES[id]}</label>
        <input type="text" data-id="${id}" data-k="handle" aria-label="${NAMES[id]} handle" placeholder="${PLACEHOLDER[id]}">
        <input type="text" data-id="${id}" data-k="repo" aria-label="${NAMES[id]} repo">`;
      row.querySelector('[data-k="enabled"]').checked = p.enabled;
      row.querySelector('[data-k="handle"]').value = p.handle;
      row.querySelector('[data-k="repo"]').value = p.repo;
      return row;
    }),
  );
  createLinks(s);
}

async function save() {
  const s = await loadSettings();
  for (const f of FIELDS) s[f] = $(f).value.trim();
  s.notify = $('notify').checked;
  for (const el of document.querySelectorAll('[data-id]')) {
    const p = s.platforms[el.dataset.id];
    p[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim();
  }
  await chrome.storage.local.set({ settings: s });
  createLinks(s);
}

$('platforms').addEventListener('change', save);
$('save').addEventListener('click', async () => {
  await save();
  $('save').disabled = true;
  $('msg').textContent = 'Checking token and repos...';
  const res = await chrome.runtime.sendMessage({ type: 'ac-commit:test' });
  $('save').disabled = false;
  $('msg').textContent = 'Saved.';
  await render();
  $('results').replaceChildren(
    ...Object.entries(res || {}).map(([id, r]) => {
      const p = document.createElement('p');
      p.className = r.ok ? 'ok' : 'err';
      p.textContent = `${NAMES[id] || id}: ${r.message}`;
      return p;
    }),
  );
});

render();
