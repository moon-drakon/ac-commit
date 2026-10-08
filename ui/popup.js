import { loadSettings } from '../src/settings.js';

const NAMES = { codeforces: 'Codeforces', leetcode: 'LeetCode', codechef: 'CodeChef' };
const $ = (id) => document.getElementById(id);

function ago(ms) {
  if (!ms) return 'never';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

async function render() {
  const settings = await loadSettings();
  const { state = {} } = await chrome.storage.local.get('state');
  const cards = [];
  if (!settings.token) {
    const c = document.createElement('div');
    c.className = 'card err';
    c.textContent = 'Add a GitHub token in Settings to start.';
    cards.push(c);
  }
  for (const [id, cfg] of Object.entries(settings.platforms)) {
    if (!cfg.enabled) continue;
    const s = state[id] || {};
    const c = document.createElement('div');
    c.className = 'card';
    const repoUrl = `https://github.com/${settings.owner}/${cfg.repo}${cfg.folder ? `/tree/${settings.branch}/${cfg.folder}` : ''}`;
    c.innerHTML = `
      <p><span class="name"></span> <span class="muted solved"></span></p>
      <p class="muted"><a class="repo" target="_blank" rel="noopener"></a> · checked <span class="checked"></span></p>
      <p class="muted last"></p>
      <p class="err error"></p>`;
    c.querySelector('.name').textContent = NAMES[id];
    c.querySelector('.solved').textContent = s.solved != null ? `${s.solved} solved` : '';
    const a = c.querySelector('.repo');
    a.href = repoUrl;
    a.textContent = cfg.folder ? `${cfg.repo}/${cfg.folder}` : cfg.repo;
    c.querySelector('.checked').textContent = ago(s.lastCheck);
    c.querySelector('.last').textContent = s.lastPushed ? `Last push: ${s.lastPushed.message} (${ago(s.lastPushed.at)})` : '';
    c.querySelector('.error').textContent = s.error || '';
    cards.push(c);
  }
  $('list').replaceChildren(...cards);
}

$('settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('sync').addEventListener('click', async () => {
  $('sync').disabled = true;
  $('msg').textContent = 'Syncing...';
  await chrome.runtime.sendMessage({ type: 'ac-commit:sync-now' });
  $('sync').disabled = false;
  $('msg').textContent = 'Done.';
  render();
});

chrome.storage.onChanged.addListener(render);
render();
