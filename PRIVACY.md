# Privacy policy

AC Commit is a browser extension. It copies your accepted competitive programming solutions to
your own GitHub repository. This page lists what data it handles and where that data goes.

Last updated: 2026-10-08.

## Data the extension handles

| Data | Why | Where it is stored | Where it is sent |
|---|---|---|---|
| Your GitHub access token | To write commits to your repo | Your browser's extension storage (`chrome.storage.local`) | `api.github.com` only |
| Your judge handles, repo name, and folders | To know which submissions to read and where to write them | Your browser's extension storage | Nowhere |
| Your submissions and their source code on Codeforces, LeetCode, and CodeChef | To commit your accepted code | Not stored by the extension | Your own GitHub repo, through `api.github.com` |
| Your GitHub login, name, and noreply email | To author the commits as you | Your browser's extension storage | `api.github.com`, as the commit author |

## What the extension does not do

- It has no server. No data goes to the developer or to any third party.
- It does not collect analytics, usage statistics, or crash reports.
- It does not read pages on any site other than `codeforces.com`, `leetcode.com`, `www.codechef.com`, and `api.github.com`.
- It does not sell or share data, and does not use it for advertising or credit decisions.

## Your control

- Remove the token in the extension's settings, or revoke it on GitHub at any time.
- Remove the extension to delete everything it stored in your browser.
- Your solutions repo belongs to you. The extension never deletes a repo.

## Contact

Open an issue at https://github.com/moon-drakon/ac-commit/issues.
