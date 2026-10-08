import { extFor, labelFor, normalizeCode } from '../lang.js';

// Codeforces: the public API lists submissions. The code itself needs your login
// session, and plain scripts get a Cloudflare 403, so it is fetched through an open
// codeforces.com tab (see content/agent.js).
const GYM_START = 100000;

const isGym = (contestId) => contestId >= GYM_START;
const keyOf = (p) => (isGym(p.contestId) ? `gym/${p.contestId}/${p.index}` : `${p.contestId}/${p.index}`);

export default {
  id: 'codeforces',
  short: 'CF',
  name: 'Codeforces',
  diffLabel: 'Rating',
  needsTab: true,
  needsHandle: true,
  fetchDelay: 400,
  origin: 'https://codeforces.com',
  layout: '`contest/problem.ext` (for example `1900/A.cpp`, gym problems under `gym/`)',
  profileUrl: (h) => `https://codeforces.com/profile/${encodeURIComponent(h)}`,
  hotUrl: /\/(problem|my|status|submission|submit)/,

  keyFromPath(path) {
    const m = path.match(/^((?:gym\/)?\d+\/[A-Za-z0-9]+)\.[A-Za-z0-9]+$/);
    return m ? m[1] : null;
  },

  async listSolved(net, cfg, { full = false } = {}) {
    const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(cfg.handle)}${full ? '' : '&from=1&count=40'}`;
    const data = await net.json(url);
    if (data.status !== 'OK') throw new Error(`Codeforces API: ${data.comment || data.status}`);
    const subs = data.result;
    const pending = subs.some((s) => !s.verdict || s.verdict === 'TESTING');
    // Oldest to newest, so the last AC seen for a problem is the latest one.
    const latest = new Map();
    for (const s of [...subs].sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds)) {
      if (s.verdict !== 'OK' || !s.problem.contestId) continue;
      const key = keyOf(s.problem);
      latest.set(key, { key, subId: s.id, time: s.creationTimeSeconds, sub: s });
    }
    return { items: [...latest.values()], pending };
  },

  async fetchSolution(net, item) {
    const s = item.sub;
    const p = s.problem;
    const base = isGym(p.contestId) ? 'gym' : 'contest';
    // The submission page no longer embeds the code. The status page's "view source" popup
    // loads it from this endpoint, which needs a logged-in session and the page's CSRF token.
    let data;
    try {
      data = await net.json(`https://codeforces.com/data/submitSource?rv=${Math.random().toString(36).slice(2, 11)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `submissionId=${s.id}`,
        csrf: true,
      });
    } catch (err) {
      if (err.status === 403) throw Object.assign(new Error('Log in to Codeforces in this browser so AC Commit can read your code.'), { status: 403 });
      throw err;
    }
    if (typeof data?.source !== 'string') throw new Error(`No source returned for submission ${s.id}.`);
    const ext = extFor(s.programmingLanguage);
    const path = `${item.key}.${ext}`;
    const id = `${p.contestId}${p.index}`;
    return {
      path,
      code: normalizeCode(data.source),
      time: s.creationTimeSeconds,
      message: `CF ${id}: ${p.name}`,
      row: {
        id,
        url: `https://codeforces.com/${base}/${p.contestId}/problem/${p.index}`,
        name: p.name,
        difficulty: p.rating ?? '-',
        lang: labelFor(ext),
        path,
      },
    };
  },
};
