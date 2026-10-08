import { extFor, labelFor, normalizeCode } from '../lang.js';

// LeetCode: submissions and code need the logged-in session, so every call goes
// through an open leetcode.com tab with the page's csrftoken cookie.
const GQL = 'https://leetcode.com/graphql/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(net, query, variables = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await net.json(GQL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        csrf: true,
      });
      if (res.errors?.length && !res.data) throw new Error(`LeetCode: ${res.errors[0].message}`);
      return res.data;
    } catch (err) {
      if (err.status === 429 && attempt < 4) { await sleep(2000 * (attempt + 1)); continue; }
      throw err;
    }
  }
}

export default {
  id: 'leetcode',
  short: 'LC',
  name: 'LeetCode',
  diffLabel: 'Difficulty',
  needsTab: true,
  needsHandle: false,
  fetchDelay: 500,
  origin: 'https://leetcode.com',
  layout: '`number-slug.ext` (for example `0001-two-sum.cpp`)',
  profileUrl: (h) => `https://leetcode.com/u/${encodeURIComponent(h)}/`,
  hotUrl: /\/problems\//,

  keyFromPath(path) {
    const m = path.match(/^\d+-([a-z0-9-]+)\.[A-Za-z0-9]+$/);
    return m ? m[1] : null;
  },

  async listSolved(net, cfg, { full = false } = {}) {
    const who = await gql(net, 'query { userStatus { isSignedIn username } }');
    if (!who.userStatus?.isSignedIn) throw new Error('Log in to LeetCode in this browser.');
    if (cfg.handle && who.userStatus.username.toLowerCase() !== cfg.handle.toLowerCase()) {
      throw new Error(`Logged in to LeetCode as ${who.userStatus.username}, expected ${cfg.handle}.`);
    }
    const accepted = [];
    let offset = 0;
    for (;;) {
      const data = await gql(
        net,
        `query ($offset: Int!, $limit: Int!) {
          submissionList(offset: $offset, limit: $limit, questionSlug: null) {
            hasNext
            submissions { id lang timestamp statusDisplay title titleSlug }
          }
        }`,
        { offset, limit: 20 },
      );
      const list = data.submissionList;
      if (!list) throw new Error('LeetCode returned no submission list. Log in again.');
      for (const s of list.submissions) if (s.statusDisplay === 'Accepted') accepted.push(s);
      if (!full || !list.hasNext) break;
      offset += 20;
      await sleep(500);
    }
    // Oldest to newest, so the last AC seen for a problem is the latest one.
    const latest = new Map();
    for (const s of accepted.sort((a, b) => Number(a.timestamp) - Number(b.timestamp))) {
      latest.set(s.titleSlug, { key: s.titleSlug, subId: s.id, time: Number(s.timestamp), sub: s });
    }
    return { items: [...latest.values()], pending: false };
  },

  async fetchSolution(net, item) {
    const s = item.sub;
    const detail = await gql(net, 'query ($id: Int!) { submissionDetails(submissionId: $id) { code } }', { id: Number(s.id) });
    if (!detail.submissionDetails) throw new Error(`No code for LeetCode submission ${s.id}.`);
    const q = (await gql(
      net,
      'query ($slug: String!) { question(titleSlug: $slug) { questionFrontendId title difficulty } }',
      { slug: s.titleSlug },
    )).question;
    const num = /^\d+$/.test(q.questionFrontendId) ? q.questionFrontendId.padStart(4, '0') : q.questionFrontendId.replace(/[^A-Za-z0-9]+/g, '-');
    const ext = extFor(s.lang);
    const path = `${num}-${s.titleSlug}.${ext}`;
    return {
      path,
      code: normalizeCode(detail.submissionDetails.code),
      time: Number(s.timestamp),
      message: `LC ${num}: ${q.title}`,
      row: {
        id: num,
        url: `https://leetcode.com/problems/${s.titleSlug}/`,
        name: q.title,
        difficulty: q.difficulty,
        lang: labelFor(ext),
        path,
      },
    };
  },
};
