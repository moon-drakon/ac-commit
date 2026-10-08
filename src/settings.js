// Owner and author fill in from the token on Save (see testRepos in background.js).
// By default all judges share one repo, each in its own folder. Give each judge its own repo
// and an empty folder to keep them separate.
export const DEFAULTS = {
  token: '',
  owner: '',
  branch: 'main',
  authorName: '',
  authorEmail: '',
  notify: true,
  platforms: {
    codeforces: { enabled: true, handle: '', repo: 'cp-solutions', folder: 'codeforces' },
    leetcode: { enabled: true, handle: '', repo: 'cp-solutions', folder: 'leetcode' },
    codechef: { enabled: true, handle: '', repo: 'cp-solutions', folder: 'codechef' },
  },
};

export function mergeSettings(saved = {}) {
  const platforms = {};
  for (const [id, def] of Object.entries(DEFAULTS.platforms)) {
    platforms[id] = { ...def, ...(saved.platforms?.[id] || {}) };
  }
  return { ...DEFAULTS, ...saved, platforms };
}

// Judges that share a repo must each have their own folder, or their files would mix.
export function layoutProblems(settings) {
  const byRepo = {};
  for (const [id, p] of Object.entries(settings.platforms)) {
    if (p.enabled && p.repo) (byRepo[p.repo] ||= []).push([id, p]);
  }
  const problems = {};
  for (const list of Object.values(byRepo)) {
    if (list.length < 2) continue;
    const seen = new Set();
    for (const [id, p] of list) {
      const folder = (p.folder || '').trim();
      if (!folder) problems[id] = `Shares ${p.repo} with another judge, so it needs a folder.`;
      else if (seen.has(folder)) problems[id] = `Folder "${folder}" is already used in ${p.repo}.`;
      seen.add(folder);
    }
  }
  return problems;
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return mergeSettings(settings);
}
