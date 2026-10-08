// Runs on judge pages. It does two things:
// 1. Tells the worker the page is open, every 10 seconds, so it can check for new ACs.
// 2. Fetches judge URLs for the worker from this page's own origin. These requests carry
//    the login session and pass the Cloudflare check the same way the page itself does.
(() => {
  const host = location.hostname;
  const platform = host.endsWith('codeforces.com') ? 'codeforces'
    : host.endsWith('leetcode.com') ? 'leetcode'
    : host.endsWith('codechef.com') ? 'codechef' : null;
  if (!platform) return;

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type !== 'ac-commit:fetch') return false;
    const headers = { ...(msg.headers || {}) };
    let body = msg.body;
    if (msg.csrf && platform === 'leetcode') {
      const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
      if (m) headers['x-csrftoken'] = decodeURIComponent(m[1]);
    }
    if (msg.csrf && platform === 'codeforces') {
      // Same headers and form field the Codeforces page adds to its own AJAX calls.
      const token = document.querySelector('meta[name="X-Csrf-Token"]')?.content || '';
      headers['X-Csrf-Token'] = token;
      headers['X-Requested-With'] = 'XMLHttpRequest';
      body = `${body ? `${body}&` : ''}csrf_token=${encodeURIComponent(token)}`;
    }
    fetch(msg.url, { method: msg.method || 'GET', headers, body, credentials: 'include' })
      .then(async (res) => reply({ ok: true, status: res.status, text: await res.text() }))
      .catch((err) => reply({ ok: false, error: String(err) }));
    return true;
  });

  let lastUrl = '';
  let timer = null;
  const tick = () => {
    // After the extension reloads, this old script loses its connection. Stop quietly.
    if (!chrome.runtime?.id) { clearInterval(timer); return; }
    const url = location.href;
    try {
      chrome.runtime.sendMessage({ type: 'ac-commit:tick', platform, url, changed: url !== lastUrl }).catch(() => {});
    } catch {
      clearInterval(timer);
      return;
    }
    lastUrl = url;
  };
  tick();
  timer = setInterval(tick, 10000);
})();
