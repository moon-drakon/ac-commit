import { Repo, GitHubError, gitBlobSha } from './github.js';
import { upsertRow, localDate, templateReadme } from './readme.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Maps between a judge's own paths ("2275/H.cpp") and repo paths ("codeforces/2275/H.cpp").
export function repoPaths(platform, folder) {
  const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
  return {
    toRepo: (path) => prefix + path,
    keyOf: (path) => {
      if (!path.startsWith(prefix)) return null;
      const rest = path.slice(prefix.length);
      return rest === 'README.md' ? null : platform.keyFromPath(rest);
    },
  };
}

// One sync pass for one judge:
// 1. List the latest AC for each problem on the judge.
// 2. Skip problems whose latest AC is already the one recorded in `synced` (problem key -> submission id).
// 3. For the rest, read the repo once. Fetch each AC's code. If the repo already holds that exact
//    code, record it and move on. Otherwise commit it, dated at the time of that AC.
export async function syncPlatform(platform, opts) {
  const {
    net, cfg, settings, synced, full = false, fetchImpl, timeZone, initialReadme,
    dryRun = false, shouldTry = () => true, onPushed, onItemError,
  } = opts;
  const { items, pending } = await platform.listSolved(net, cfg, { full });
  let todo = items.filter((i) => synced.get(i.key) !== String(i.subId));
  const pushed = [];
  const errors = [];
  if (!todo.length) return { pending, pushed, errors, total: items.length };

  const section = { platform, handle: cfg.handle, folder: cfg.folder };
  const { toRepo, keyOf } = repoPaths(platform, cfg.folder);
  const repo = new Repo({ token: settings.token, owner: settings.owner, repo: cfg.repo, branch: settings.branch, fetchImpl });
  await repo.load({ initialReadme: dryRun ? undefined : (initialReadme ?? templateReadme([section])) });
  const filesFor = (r, key) => [...r.paths].filter((p) => keyOf(p) === key);
  todo = todo.filter(shouldTry).sort((a, b) => a.time - b.time);

  for (const [n, item] of todo.entries()) {
    try {
      if (n > 0 && platform.fetchDelay) await sleep(platform.fetchDelay);
      const sol = await platform.fetchSolution(net, item, cfg);
      const path = toRepo(sol.path);
      const blob = await gitBlobSha(sol.code);
      const upToDate = (r) => {
        const files = filesFor(r, item.key);
        return files.length === 1 && files[0] === path && r.blobs.get(path) === blob;
      };
      if (upToDate(repo)) {
        synced.set(item.key, String(item.subId));
        continue;
      }
      if (dryRun) { pushed.push(sol); continue; }
      const sha = await repo.commit(
        (r) => {
          if (upToDate(r)) return null;
          const old = filesFor(r, item.key);
          const readme = upsertRow(r.readme, { ...sol.row, path, date: localDate(sol.time, timeZone) }, section);
          return {
            message: old.length ? `${sol.message} (new AC)` : sol.message,
            files: [
              { path, content: sol.code },
              // A new language means a new extension. Remove the old file so each problem keeps one file.
              ...old.filter((p) => p !== path).map((p) => ({ path: p, delete: true })),
              { path: 'README.md', content: readme },
            ],
          };
        },
        { name: settings.authorName, email: settings.authorEmail, date: new Date(sol.time * 1000).toISOString() },
      );
      synced.set(item.key, String(item.subId));
      if (sha) {
        pushed.push(sol);
        await onPushed?.(sol, sha, item);
      }
    } catch (err) {
      // GitHub errors (bad token, no access) affect every item, so stop. Judge errors only skip this item.
      if (err instanceof GitHubError) throw err;
      errors.push({ key: item.key, message: err.message });
      await onItemError?.(item, err);
    }
  }
  return { pending, pushed, errors, total: items.length };
}
