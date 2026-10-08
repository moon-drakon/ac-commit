import { extFor, labelFor, normalizeCode, decodeHtml } from '../lang.js';

// CodeChef: the recent-submissions list, submission details, and code are public,
// so this platform can sync from the background worker without an open tab.
const BASE = 'https://www.codechef.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseRecent(html) {
  const rows = [];
  for (const tr of html.split(/<tr\b/).slice(1)) {
    const sol = tr.match(/\/viewsolution\/(\d+)/);
    const prob = tr.match(/href='\/(?:([A-Za-z0-9_]+)\/)?problems\/([A-Za-z0-9_]+)'/);
    if (!sol || !prob) continue;
    const status = (tr.match(/<span title='([^']*)'/) || [])[1] || '';
    const lang = (tr.match(/<td\s+title='([^']*)'>[^<]*<\/td>\s*<td class="centered"/) || [])[1] || '';
    rows.push({ id: Number(sol[1]), contest: prob[1] || 'PRACTICE', code: prob[2], status: decodeHtml(status), lang });
  }
  return rows;
}

export default {
  id: 'codechef',
  short: 'CC',
  name: 'CodeChef',
  diffLabel: 'Rating',
  needsTab: false,
  needsHandle: true,
  fetchDelay: 300,
  origin: BASE,
  layout: '`PROBLEMCODE.ext` (for example `FLOW001.cpp`)',
  profileUrl: (h) => `${BASE}/users/${encodeURIComponent(h)}`,
  hotUrl: /\/(problems|submit)\//,

  keyFromPath(path) {
    if (path === 'README.md') return null;
    const m = path.match(/^([A-Za-z0-9_]+)\.[A-Za-z0-9]+$/);
    return m ? m[1] : null;
  },

  async listSolved(net, cfg, { full = false } = {}) {
    const rows = [];
    let maxPage = 0;
    for (let page = 0; page <= maxPage; page++) {
      const data = await net.json(`${BASE}/recent/user?page=${page}&user_handle=${encodeURIComponent(cfg.handle)}`);
      if (page === 0 && full) maxPage = Number(data.max_page) || 0;
      rows.push(...parseRecent(data.content || ''));
      if (page < maxPage) await sleep(400);
    }
    // Submission ids grow over time, so the last AC seen for a problem is the latest one.
    const latest = new Map();
    for (const r of rows.sort((a, b) => a.id - b.id)) {
      if (r.status !== 'accepted') continue;
      latest.set(r.code, { key: r.code, subId: r.id, time: r.id, sub: r });
    }
    const pending = rows.some((r) => /running|compil|waiting|queue/i.test(r.status));
    return { items: [...latest.values()], pending };
  },

  async fetchSolution(net, item) {
    const r = item.sub;
    const details = (await net.json(`${BASE}/api/submission-details/${r.id}`)).data?.other_details;
    const code = (await net.json(`${BASE}/api/submission-code/${r.id}`)).data?.code;
    if (!details || code == null) throw new Error(`No code for CodeChef submission ${r.id}.`);
    const ext = extFor(details.languageShortName || r.lang);
    const path = `${r.code}.${ext}`;
    const time = Math.floor(Number(details.submissionDate) / 1000);
    return {
      path,
      code: normalizeCode(code),
      time,
      message: `CC ${r.code}: ${details.problemName}`,
      row: {
        id: r.code,
        url: `${BASE}/problems/${r.code}`,
        name: details.problemName,
        difficulty: details.difficultyRating || '-',
        lang: labelFor(ext),
        path,
      },
    };
  },
};
