import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extFor, labelFor, normalizeCode, decodeHtml } from '../src/lang.js';
import { upsertRow, upsertRows, templateReadme, markers, localDate } from '../src/readme.js';
import { Repo, gitBlobSha, whoAmI } from '../src/github.js';
import { syncPlatform, repoPaths } from '../src/sync.js';
import { layoutProblems, mergeSettings } from '../src/settings.js';
import codeforces from '../src/platforms/codeforces.js';
import leetcode from '../src/platforms/leetcode.js';
import codechef, { parseRecent } from '../src/platforms/codechef.js';
import { fakeGitHub } from './fake-github.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const rowIds = (readme) => readme.split('\n').filter((l) => l.startsWith('| [')).map((l) => l.slice(3, l.indexOf(']')));
const SETTINGS = { token: 't', owner: 'o', branch: 'main', authorName: 'N', authorEmail: 'e@x' };

test('language names map to extensions', () => {
  const cases = {
    'GNU C11': 'c', 'C++17 (GCC 7-32)': 'cpp', 'C++20 (GCC 13-64)': 'cpp', 'GNU G++17 7.3.0': 'cpp',
    'Clang++20 Diagnostics': 'cpp', 'PyPy 3-64': 'py', 'Python 3': 'py', 'Java 21': 'java',
    'JavaScript V8 4.8.0': 'js', 'Node.js 15.8.0': 'js', 'C# 10': 'cs', 'Kotlin 1.9': 'kt',
    'Go 1.22.2': 'go', 'Rust 2021': 'rs', 'Haskell GHC 8.10.1': 'hs', 'Delphi 7': 'pas',
    cpp: 'cpp', c: 'c', python3: 'py', golang: 'go', csharp: 'cs', typescript: 'ts', mysql: 'sql',
    'PYTH 3': 'py', 'C++': 'cpp', C: 'c', JAVA: 'java', PYPY3: 'py', KTLN: 'kt', NODEJS: 'js', GO: 'go',
    RUST: 'rs', 'C++14': 'cpp', 'C++17': 'cpp',
  };
  for (const [name, ext] of Object.entries(cases)) assert.equal(extFor(name), ext, name);
  assert.equal(labelFor('cpp'), 'C++');
  assert.equal(labelFor('c'), 'C');
});

test('code is stored with LF and one final newline', () => {
  assert.equal(normalizeCode('a\r\nb\r\n\r\n'), 'a\nb\n');
  assert.equal(normalizeCode('\nint x;'), '\nint x;\n');
  assert.equal(decodeHtml('a &lt;&lt; b &amp;&amp; c &gt; &quot;d&quot; &#39;e&#39; &#x41;'), 'a << b && c > "d" \'e\' A');
});

test('git blob ids match git', async () => {
  // `printf 'hello\n' | git hash-object --stdin`
  assert.equal(await gitBlobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.equal(await gitBlobSha(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

const row = (id, date, extra = {}) => ({
  id, date, url: `https://x/${id}`, name: `Name ${id}`, difficulty: 800, lang: 'C++', path: `${id}.cpp`, ...extra,
});

const CF = { platform: codeforces, handle: 'someone', folder: 'codeforces' };
const [CF_START, CF_END] = markers('codeforces');

test('README section is appended once and keeps outside text', () => {
  const base = '# Title\n\nIntro line.\n';
  const a = upsertRow(base, row('1A', '2026-10-01'), CF);
  assert.ok(a.startsWith('# Title\n\nIntro line.\n\n## Codeforces\n\nProfile: [someone](https://codeforces.com/profile/someone). Files are in `codeforces/`'));
  assert.ok(a.trimEnd().endsWith(CF_END));
  assert.match(a, /Solved: \*\*1\*\*/);
  assert.match(a, /\| Problem \| Name \| Rating \| Code \| Last AC \|/);
  const b = upsertRow(`${a}\nFooter.\n`, row('2B', '2026-10-03'), CF);
  assert.equal(b.split(CF_START).length, 2);
  assert.ok(b.endsWith('\nFooter.\n'));
  assert.deepEqual(rowIds(b), ['2B', '1A']);
});

test('README rows sort by date, newest first, and a new AC moves its row', () => {
  let r = upsertRows('', [row('A', '2026-01-01'), row('B', '2026-01-02'), row('C', '2026-01-02')], CF);
  assert.deepEqual(rowIds(r), ['C', 'B', 'A']);
  r = upsertRow(r, row('A', '2026-01-05', { name: 'New | name' }), CF);
  assert.deepEqual(rowIds(r), ['A', 'C', 'B']);
  assert.match(r, /New \\\| name/);
  assert.match(r, /Solved: \*\*3\*\*/);
});

test('template README for a repo with one judge', () => {
  const single = { platform: codeforces, handle: 'someone' };
  const r = templateReadme([single]);
  assert.match(r, /^# Codeforces solutions\n/);
  assert.match(r, /\[someone\]\(https:\/\/codeforces\.com\/profile\/someone\)/);
  assert.match(r, /latest accepted submission/);
  assert.match(r, /Solved: \*\*0\*\*/);
  assert.ok(!r.includes('Total solved'));
  assert.ok(!r.includes(String.fromCharCode(0x2014)), 'no em dash');
  assert.match(templateReadme([{ platform: leetcode, handle: '' }]), /My accepted solutions on LeetCode\.\n/);
  assert.deepEqual(rowIds(upsertRow(r, row('1A', '2026-10-01'), single)), ['1A']);
});

test('template README for a shared repo keeps a total across judges', () => {
  const LC = { platform: leetcode, handle: '', folder: 'leetcode' };
  const CC = { platform: codechef, handle: 'chef', folder: 'codechef' };
  let r = templateReadme([CF, LC, CC]);
  assert.match(r, /^# Competitive programming solutions\n/);
  assert.match(r, /on Codeforces, LeetCode, and CodeChef\./);
  assert.match(r, /Total solved: \*\*0\*\*/);
  assert.deepEqual([...r.matchAll(/^## (.+)$/gm)].map((m) => m[1]), ['Codeforces', 'LeetCode', 'CodeChef']);
  assert.match(r, /Files are in `leetcode\/`, named `number-slug\.ext`/);
  assert.ok(!r.includes(String.fromCharCode(0x2014)), 'no em dash');
  r = upsertRow(r, row('1A', '2026-10-01'), CF);
  r = upsertRow(r, row('2B', '2026-10-02'), CF);
  r = upsertRow(r, row('0001', '2026-10-03', { name: 'Two Sum' }), LC);
  assert.match(r, /Total solved: \*\*3\*\*/);
  assert.deepEqual(rowIds(r.slice(r.indexOf(CF_START), r.indexOf(CF_END))), ['2B', '1A']);
  assert.match(r.slice(r.indexOf(markers('leetcode')[0])), /Solved: \*\*1\*\*[\s\S]*Two Sum/);
  assert.match(r.slice(r.indexOf(markers('codechef')[0])), /Solved: \*\*0\*\*/);
});

test('folders map repo paths to problem keys', () => {
  const cf = repoPaths(codeforces, 'codeforces');
  assert.equal(cf.toRepo('2275/H.cpp'), 'codeforces/2275/H.cpp');
  assert.equal(cf.keyOf('codeforces/2275/H.cpp'), '2275/H');
  assert.equal(cf.keyOf('2275/H.cpp'), null);
  assert.equal(cf.keyOf('README.md'), null);
  const cc = repoPaths(codechef, 'codechef/');
  assert.equal(cc.keyOf('codechef/FLOW001.cpp'), 'FLOW001');
  assert.equal(cc.keyOf('codechef/README.md'), null);
  assert.equal(cc.keyOf('codeforces/2275/H.cpp'), null);
  assert.equal(repoPaths(codechef, '').keyOf('README.md'), null);
});

test('judges that share a repo need their own folders', () => {
  assert.deepEqual(layoutProblems(mergeSettings()), {});
  const s = mergeSettings({ platforms: { leetcode: { folder: '' }, codechef: { folder: 'codeforces' } } });
  assert.deepEqual(Object.keys(layoutProblems(s)).sort(), ['codechef', 'leetcode']);
  const separate = mergeSettings({ platforms: { codeforces: { repo: 'a', folder: '' }, leetcode: { repo: 'b', folder: '' }, codechef: { repo: 'c', folder: '' } } });
  assert.deepEqual(layoutProblems(separate), {});
});

test('local date uses the given time zone', () => {
  // 2026-10-07T20:00:00Z is already 2026-10-08 in Dhaka (UTC+6).
  const t = Date.UTC(2026, 9, 7, 20) / 1000;
  assert.equal(localDate(t, 'Asia/Dhaka'), '2026-10-08');
  assert.equal(localDate(t, 'UTC'), '2026-10-07');
});

test('paths map back to problem keys', () => {
  assert.equal(codeforces.keyFromPath('2275/H.cpp'), '2275/H');
  assert.equal(codeforces.keyFromPath('1971/C.c'), '1971/C');
  assert.equal(codeforces.keyFromPath('gym/104114/A1.py'), 'gym/104114/A1');
  assert.equal(codeforces.keyFromPath('README.md'), null);
  assert.equal(leetcode.keyFromPath('0001-two-sum.cpp'), 'two-sum');
  assert.equal(leetcode.keyFromPath('README.md'), null);
  assert.equal(codechef.keyFromPath('FLOW001.cpp'), 'FLOW001');
  assert.equal(codechef.keyFromPath('README.md'), null);
});

test('Codeforces keeps the latest AC per problem', async () => {
  const net = {
    json: async () => ({
      status: 'OK',
      result: [
        { id: 3, creationTimeSeconds: 300, verdict: 'OK', problem: { contestId: 1, index: 'A' } },
        { id: 2, creationTimeSeconds: 200, verdict: 'WRONG_ANSWER', problem: { contestId: 1, index: 'A' } },
        { id: 1, creationTimeSeconds: 100, verdict: 'OK', problem: { contestId: 1, index: 'A' } },
        { id: 4, creationTimeSeconds: 400, verdict: 'TESTING', problem: { contestId: 1, index: 'B' } },
      ],
    }),
  };
  const { items, pending } = await codeforces.listSolved(net, { handle: 'h' });
  assert.deepEqual(items.map((i) => [i.key, i.subId]), [['1/A', 3]]);
  assert.equal(pending, true);
});

test('CodeChef recent table parses and keeps the latest AC', async () => {
  const data = fixture('codechef-recent.json');
  const rows = parseRecent(data.content);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { id: 5003, contest: 'START200A', code: 'SAMPLEB', status: 'accepted', lang: 'C++' });
  assert.equal(rows[1].status, 'wrong answer');
  assert.equal(rows[2].contest, 'PRACTICE');
  const { items } = await codechef.listSolved({ json: async () => data }, { handle: 'h' });
  assert.deepEqual(items.map((i) => [i.key, i.subId]).sort(), [['SAMPLEA', 5001], ['SAMPLEB', 5003]]);
});

test('whoAmI builds the noreply email', async () => {
  const gh = fakeGitHub();
  assert.deepEqual(await whoAmI('t', gh.fetchImpl), { login: 'someone', name: 'Some One', email: '42+someone@users.noreply.github.com' });
});

test('Repo.load writes a README into an empty repo', async () => {
  const gh = fakeGitHub({ empty: true });
  const repo = await new Repo({ token: 't', owner: 'o', repo: 'r', fetchImpl: gh.fetchImpl }).load({ initialReadme: '# Hi\n' });
  assert.equal(repo.readme, '# Hi\n');
  assert.deepEqual([...repo.paths], ['README.md']);
  await assert.rejects(new Repo({ token: 't', owner: 'o', repo: 'r2', fetchImpl: fakeGitHub({ empty: true }).fetchImpl }).load(), /no "main" branch/);
});

test('Repo.commit rebuilds on top of the new head after a conflict', async () => {
  const gh = fakeGitHub({ conflictOnce: true });
  const repo = new Repo({ token: 't', owner: 'o', repo: 'r', fetchImpl: gh.fetchImpl });
  let builds = 0;
  const sha = await repo.commit((r) => {
    builds++;
    return { message: 'm', files: [{ path: 'a.cpp', content: `paths=${r.paths.size}\n` }] };
  }, { name: 'N', email: 'e@x', date: '2026-10-08T00:00:00Z' });
  assert.ok(sha);
  assert.equal(builds, 2);
  assert.equal(gh.state.files['other.cpp'], 'x\n');
  assert.equal(gh.state.files['a.cpp'], 'paths=2\n');
  assert.equal(gh.state.commits[0].author.date, '2026-10-08T00:00:00Z');
  assert.equal(gh.state.commits[0].committer.name, 'N');
});

// A fake judge: problems are `contest/index`, code is whatever `codes` says for a submission id.
function fakeJudge(items, codes, ext = 'cpp') {
  return {
    ...codeforces,
    fetchDelay: 0,
    async listSolved() { return { pending: false, items }; },
    async fetchSolution(_net, item) {
      if (!(item.subId in codes)) throw new Error(`judge failed for ${item.key}`);
      const [c, i] = item.key.split('/');
      const e = typeof ext === 'function' ? ext(item) : ext;
      return {
        path: `${item.key}.${e}`, code: codes[item.subId], time: item.time, message: `CF ${c}${i}: P${i}`,
        row: { id: `${c}${i}`, url: 'u', name: `P${i}`, difficulty: '-', lang: e, path: `${item.key}.${e}` },
      };
    },
  };
}

test('sync commits new problems oldest first, and skips code the repo already has', async () => {
  const gh = fakeGitHub({ files: { 'README.md': '# CF\n', '1/A.cpp': 'same\n' } });
  const judge = fakeJudge(
    [
      { key: '1/A', subId: 10, time: 100 },
      { key: '3/C', subId: 30, time: 1791427671 },
      { key: '2/B', subId: 20, time: 1791384300 },
    ],
    { 10: 'same\n', 20: '// B\n', 30: '// C\n' },
  );
  const synced = new Map();
  const res = await syncPlatform(judge, { net: null, cfg: { repo: 'r', handle: 'h' }, settings: SETTINGS, synced, fetchImpl: gh.fetchImpl, timeZone: 'Asia/Dhaka' });
  assert.deepEqual(res.pushed.map((s) => s.message), ['CF 2B: PB', 'CF 3C: PC']);
  assert.equal(gh.state.commits.length, 2, '1/A already had the same code, so no commit');
  assert.equal(gh.state.commits[0].author.date, new Date(1791384300 * 1000).toISOString());
  assert.equal(gh.state.files['2/B.cpp'], '// B\n');
  assert.deepEqual(Object.fromEntries(synced), { '1/A': '10', '2/B': '20', '3/C': '30' });

  // Nothing changed on the judge: the next pass does not call GitHub at all.
  const calls = gh.state.calls.length;
  const again = await syncPlatform(judge, { net: null, cfg: { repo: 'r' }, settings: SETTINGS, synced, fetchImpl: gh.fetchImpl, timeZone: 'UTC' });
  assert.equal(again.pushed.length, 0);
  assert.equal(gh.state.calls.length, calls);
});

test('a newer AC replaces the file, and a new language removes the old file', async () => {
  const gh = fakeGitHub({ files: { 'README.md': '# CF\n', '1/A.c': 'old C\n' } });
  const synced = new Map([['1/A', '10']]);
  const judge = fakeJudge([{ key: '1/A', subId: 11, time: 1791427671 }], { 11: 'new C++\n' }, 'cpp');
  const res = await syncPlatform(judge, { net: null, cfg: { repo: 'r' }, settings: SETTINGS, synced, fetchImpl: gh.fetchImpl, timeZone: 'UTC' });
  assert.equal(res.pushed.length, 1);
  assert.equal(gh.state.commits[0].message, 'CF 1A: PA (new AC)');
  assert.equal(gh.state.files['1/A.cpp'], 'new C++\n');
  assert.equal(gh.state.files['1/A.c'], undefined);
  assert.equal(synced.get('1/A'), '11');
  assert.deepEqual(rowIds(gh.state.files['README.md']), ['1A']);
});

test('folder mode writes under the folder and ignores other judges', async () => {
  const gh = fakeGitHub({ files: { 'README.md': '# CP\n', 'codeforces/1/A.cpp': 'same\n', 'codechef/1.cpp': 'cc\n', '1/B.cpp': 'stray\n' } });
  const judge = fakeJudge([{ key: '1/A', subId: 1, time: 100 }, { key: '1/B', subId: 2, time: 1791427671 }], { 1: 'same\n', 2: 'b\n' });
  const res = await syncPlatform(judge, { net: null, cfg: { repo: 'r', handle: 'h', folder: 'codeforces' }, settings: SETTINGS, synced: new Map(), fetchImpl: gh.fetchImpl, timeZone: 'UTC' });
  assert.deepEqual(res.pushed.map((p) => p.message), ['CF 1B: PB']);
  assert.equal(gh.state.files['codeforces/1/B.cpp'], 'b\n');
  assert.equal(gh.state.files['1/B.cpp'], 'stray\n', 'files outside the folder are left alone');
  assert.equal(gh.state.files['codechef/1.cpp'], 'cc\n');
  assert.match(gh.state.files['README.md'], /\[cpp\]\(codeforces\/1\/B\.cpp\)/);
});

test('a judge error skips one problem and keeps going', async () => {
  const gh = fakeGitHub();
  const judge = fakeJudge([{ key: '9/X', subId: 1, time: 1 }, { key: '9/Y', subId: 2, time: 2 }], { 2: 'y\n' });
  const res = await syncPlatform(judge, { net: null, cfg: { repo: 'r' }, settings: SETTINGS, synced: new Map(), fetchImpl: gh.fetchImpl, timeZone: 'UTC' });
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].key, '9/X');
  assert.equal(res.pushed.length, 1);
});

test('sync sets up an empty repo with the template README', async () => {
  const gh = fakeGitHub({ empty: true });
  const judge = fakeJudge([{ key: '5/E', subId: 1, time: 1791427671 }], { 1: 'e\n' });
  await syncPlatform(judge, { net: null, cfg: { repo: 'r', handle: 'h' }, settings: SETTINGS, synced: new Map(), fetchImpl: gh.fetchImpl, timeZone: 'UTC' });
  assert.match(gh.state.files['README.md'], /^# Codeforces solutions/);
  assert.match(gh.state.files['README.md'], /Solved: \*\*1\*\*/);
  assert.equal(gh.state.files['5/E.cpp'], 'e\n');
});
