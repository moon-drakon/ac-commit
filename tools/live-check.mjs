// Read-only check against the real judges and GitHub. It never pushes.
//
//   GITHUB_TOKEN=... CF_HANDLE=... CC_HANDLE=... node tools/live-check.mjs
//
// Optional: OWNER (defaults to the token's account), CF_REPO (defaults to codeforces-solutions).
import { fetchNet } from '../src/net.js';
import { Repo, whoAmI } from '../src/github.js';
import codeforces from '../src/platforms/codeforces.js';
import codechef from '../src/platforms/codechef.js';

const env = process.env;
const net = fetchNet();
const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? `: ${extra}` : ''}`);

if (env.GITHUB_TOKEN) {
  const me = await whoAmI(env.GITHUB_TOKEN);
  ok('GitHub token works', !!me.login, `${me.login}, ${me.email}`);
  env.OWNER ||= me.login;
}

// Codeforces: the API lists submissions, and every latest AC maps to one file in the repo.
// (The code itself needs a logged-in browser tab, so this check stops at the file list.)
if (env.CF_HANDLE) {
  const { items } = await codeforces.listSolved(net, { handle: env.CF_HANDLE }, { full: true });
  ok('Codeforces API lists accepted problems', items.length > 0, `${items.length} problems`);
  if (env.GITHUB_TOKEN) {
    const repo = await new Repo({ token: env.GITHUB_TOKEN, owner: env.OWNER, repo: env.CF_REPO || 'codeforces-solutions' }).load();
    const keys = new Set([...repo.paths].map((p) => codeforces.keyFromPath(p)).filter(Boolean));
    const missing = items.filter((i) => !keys.has(i.key)).map((i) => i.key);
    ok('Every Codeforces AC has a file in the repo', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : `${keys.size} files`);
  }
}

// CodeChef: everything is public, so fetch one solution end to end.
if (env.CC_HANDLE) {
  const { items } = await codechef.listSolved(net, { handle: env.CC_HANDLE }, { full: false });
  ok(`CodeChef recent list for ${env.CC_HANDLE}`, Array.isArray(items), `${items.length} accepted on page 0`);
  if (items.length) {
    const sol = await codechef.fetchSolution(net, items.at(-1));
    ok('CodeChef solution fetch', sol.code.length > 0 && sol.time > 1e9, `${sol.path}, "${sol.message}", ${new Date(sol.time * 1000).toISOString()}`);
  }
}

// LeetCode: the queries the extension sends must pass schema validation (no login needed for this).
{
  const post = (query, variables = {}) => net.json('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer: 'https://leetcode.com' },
    body: JSON.stringify({ query, variables }),
  });
  const who = await post('query { userStatus { isSignedIn username } }');
  ok('LeetCode userStatus query is valid', who.data?.userStatus?.isSignedIn === false, JSON.stringify(who.data));
  const q = await post('query ($slug: String!) { question(titleSlug: $slug) { questionFrontendId title difficulty } }', { slug: 'two-sum' });
  ok('LeetCode question query is valid', q.data?.question?.questionFrontendId === '1', JSON.stringify(q.data));
  const d = await post('query ($id: Int!) { submissionDetails(submissionId: $id) { code } }', { id: 1 });
  ok('LeetCode submissionDetails query is valid', !d.errors, JSON.stringify(d));
}
