# AC Commit

AC Commit is a Chrome and Edge extension. It turns every accepted solution on Codeforces,
LeetCode, and CodeChef into a commit in your GitHub repo. Each commit is dated at the time
of the AC, so your contribution graph shows when you solved each problem.

- One repo, one folder per judge, one file per problem. Each file holds your latest AC.
  You can also give each judge its own repo.
- A problem table in each repo's README, updated in the same commit.
- No server in the middle. The extension talks only to the judges and to `api.github.com`.

## Install

1. Download `ac-commit-<version>.zip` from the
   [latest release](https://github.com/moon-drakon/ac-commit/releases/latest) and unzip it.
   You can also clone this repo.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. The settings page opens. Follow the steps there:
   1. Enter your handles. Create the solutions repo with the link on the page.
   2. Click **Create a fine-grained token**. Pick your solutions repo.
      Check that **Contents** is **Read and write**. Generate the token and paste it.
   3. Click **Save and check**. AC Commit fills in your account and adds a README to empty repos.

Stay logged in to Codeforces and LeetCode in the same browser.

## How it works

| Judge | How AC Commit reads your code | When it syncs |
|---|---|---|
| Codeforces | The public API lists your submissions. The code comes from the endpoint behind the status page's "view source" popup, through your open codeforces.com tab. | While a codeforces.com tab is open |
| LeetCode | GraphQL calls through your open leetcode.com tab, with your session. | While a leetcode.com tab is open |
| CodeChef | Public endpoints. No tab and no login needed. | Every 30 minutes, and faster while a codechef.com tab is open |

The judge tabs report to the extension every 10 seconds. The extension then checks for new ACs:

| Situation | Check interval |
|---|---|
| Two minutes after a submit, or while a verdict is pending | 8 s |
| On a problem page | 20 s |
| On any other judge page | 90 s |
| In the background | 30 min |

For each problem, AC Commit takes your latest AC. If the repo already has that exact code, it
skips the problem. Otherwise it commits the file and the README row together. If you switch
language, the old file is removed in the same commit. The branch update refuses
non-fast-forward pushes, so two browsers syncing at once cannot overwrite each other.

The first sync also adds every past AC that is not in the repo yet.

## Repo layout

By default all judges share one repo named `cp-solutions`:

| Judge | File | Commit message |
|---|---|---|
| Codeforces | `codeforces/2275/H.cpp`, gym: `codeforces/gym/104114/A.cpp` | `CF 2275H: <name>` |
| LeetCode | `leetcode/0001-two-sum.cpp` | `LC 0001: Two Sum` |
| CodeChef | `codechef/FLOW001.cpp` | `CC FLOW001: <name>` |

To keep a judge in its own repo, give it a different repo name in settings and clear its folder.
Judges that share a repo must each have their own folder.

A newer AC for a problem you already have is committed as `<message> (new AC)`.
Code is stored as submitted, with LF line endings and one final newline.
The README has one table per judge, between `<!-- ac-commit:<judge>:start -->` and
`<!-- ac-commit:<judge>:end -->`. A shared repo also gets a total line. Text outside the
markers is not changed.

Example: [moon-drakon/cp-solutions](https://github.com/moon-drakon/cp-solutions).

## Privacy

- Your GitHub token stays in the extension's local storage. It is sent only to `api.github.com`.
- Judge requests run in your own browser, with your own session. Nothing goes to a third-party server.
- The extension asks for access to `codeforces.com`, `leetcode.com`, `www.codechef.com`, and `api.github.com` only.

## Development

```bash
npm test
```

25 tests cover language mapping, the README tables, folders, git blob ids, the GitHub commit
retry, empty-repo setup, the sync pass, and the service worker with a fake `chrome` API.
There are no dependencies to install.

```bash
GITHUB_TOKEN=<token> CF_HANDLE=<handle> CC_HANDLE=<handle> npm run live
```

The live check reads the real judges and GitHub. It never pushes.

```bash
npm run pack
npm run screens
```

`pack` writes the release zip to `dist/`. `screens` renders the store images into `store/` with
headless Chrome. The store listing text is in [store/listing.md](store/listing.md).

### Add a judge

Each judge is one file in `src/platforms/`. It exports:

- `listSolved(net, cfg, { full })`: the latest AC per problem, as `{ key, subId, time }`.
- `fetchSolution(net, item)`: the code, file path, commit message, and README row.
- `keyFromPath(path)`: the problem key for a file in the repo.

Then add the judge to `PLATFORMS` in `src/background.js` and to `manifest.json`.

## Limits

- Codeforces and LeetCode sync only while a tab of that site is open and you are logged in.
- Solutions you submit from a phone sync the next time you open the site on your computer.
- Codeforces "view source" and LeetCode GraphQL are not public APIs. If a judge changes them,
  that judge stops syncing and the popup shows the error.
- The extension is not in the Chrome Web Store yet. Install it with **Load unpacked**.

## Privacy policy

See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
