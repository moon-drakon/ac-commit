// Fake `chrome` API with sample data, so the real UI pages render outside the extension.
(() => {
  const now = Date.now();
  const data = {
    settings: {
      token: 'github_pat_sample_value_for_screenshots',
      owner: 'moon-drakon',
      branch: 'main',
      authorName: 'Shibli Rahman Moon',
      authorEmail: '91358572+moon-drakon@users.noreply.github.com',
      notify: true,
      platforms: {
        codeforces: { enabled: true, handle: 'shiblimoon', repo: 'cp-solutions', folder: 'codeforces' },
        leetcode: { enabled: true, handle: 'moon_drakon', repo: 'cp-solutions', folder: 'leetcode' },
        codechef: { enabled: true, handle: 'moon_drakon', repo: 'cp-solutions', folder: 'codechef' },
      },
    },
    state: {
      codeforces: { lastCheck: now - 12000, solved: 23, error: null, lastPushed: { message: 'CF 2275H: A Problem to Warm Up the Eyebrows', at: now - 40000 } },
      leetcode: { lastCheck: now - 25000, solved: 4, error: null, lastPushed: { message: 'LC 0001: Two Sum', at: now - 3 * 3600 * 1000 } },
      codechef: { lastCheck: now - 6 * 60 * 1000, solved: 2, error: null, lastPushed: { message: 'CC FLOW001: Add Two Numbers', at: now - 26 * 3600 * 1000 } },
    },
  };
  const results = {
    github: { ok: true, message: 'Token works for moon-drakon. Commits are authored as Shibli Rahman Moon <91358572+moon-drakon@users.noreply.github.com>.' },
    codeforces: { ok: true, message: 'moon-drakon/cp-solutions/codeforces: ready.' },
    leetcode: { ok: true, message: 'moon-drakon/cp-solutions/leetcode: ready.' },
    codechef: { ok: true, message: 'moon-drakon/cp-solutions/codechef: ready.' },
  };
  window.chrome = {
    storage: {
      local: {
        get: async (k) => (k in data ? { [k]: structuredClone(data[k]) } : {}),
        set: async (o) => Object.assign(data, structuredClone(o)),
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      sendMessage: async (msg) => (msg.type === 'ac-commit:test' ? results : {}),
      openOptionsPage() {},
    },
  };
  // options.html#checked shows the result of "Save and check".
  if (location.hash === '#checked') {
    window.addEventListener('load', () => setTimeout(() => document.getElementById('save')?.click(), 50));
  }
})();
