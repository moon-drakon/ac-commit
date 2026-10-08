// Owner and author fill in from the token on Save (see ui/options.js).
export const DEFAULTS = {
  token: '',
  owner: '',
  branch: 'main',
  authorName: '',
  authorEmail: '',
  notify: true,
  platforms: {
    codeforces: { enabled: true, handle: '', repo: 'codeforces-solutions' },
    leetcode: { enabled: true, handle: '', repo: 'leetcode-solutions' },
    codechef: { enabled: true, handle: '', repo: 'codechef-solutions' },
  },
};

export function mergeSettings(saved = {}) {
  const platforms = {};
  for (const [id, def] of Object.entries(DEFAULTS.platforms)) {
    platforms[id] = { ...def, ...(saved.platforms?.[id] || {}) };
  }
  return { ...DEFAULTS, ...saved, platforms };
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return mergeSettings(settings);
}
