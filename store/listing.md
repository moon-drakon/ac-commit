# Store listing

Copy these fields into the Chrome Web Store and Microsoft Edge Add-ons forms.
Upload `ac-commit-<version>.zip` from the latest GitHub release as the package.

## Package and images

| Field | File |
|---|---|
| Package | `ac-commit-1.1.0.zip` from https://github.com/moon-drakon/ac-commit/releases/latest |
| Icon (128x128) | `icons/128.png` |
| Screenshots (1280x800) | `store/screenshot-1-settings.png`, `store/screenshot-2-popup.png`, `store/screenshot-3-repo.png` |
| Small promo tile (440x280) | `store/promo-440x280.png` |

## Name

AC Commit

## Summary (132 characters max)

Turns every accepted Codeforces, LeetCode, and CodeChef solution into a dated commit in your GitHub repo.

## Category

Developer Tools

## Language

English

## Description

AC Commit turns every accepted solution on Codeforces, LeetCode, and CodeChef into a commit in your GitHub repo. Each commit is dated at the time of the AC, so your contribution graph shows when you solved each problem.

How it works:
- Solve a problem as usual. Within about 20 seconds of the AC, the code is in your repo.
- One repo holds every judge, each in its own folder. You can also give each judge its own repo.
- Each problem keeps your latest AC. A new AC replaces the file in a new commit.
- The README gets a problem table for each judge and a total, updated in the same commit.
- The first sync adds your past accepted solutions too.

Setup takes about two minutes:
1. Enter your judge handles.
2. Create a fine-grained GitHub token for your solutions repo, with Contents set to Read and write.
3. Paste the token and click Save and check.

Privacy:
- No server in the middle. The extension talks only to the judges and to api.github.com.
- Your token stays in your browser's extension storage.
- No analytics and no tracking.

Codeforces and LeetCode sync while a tab of that site is open and you are logged in. CodeChef also syncs every 30 minutes.

Open source under the MIT license: https://github.com/moon-drakon/ac-commit

## Single purpose

Commits the user's accepted competitive programming solutions from Codeforces, LeetCode, and CodeChef to the user's own GitHub repository.

## Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings, GitHub token, and sync state on the device. |
| `alarms` | Runs a sync every 30 minutes, so CodeChef solutions and open judge tabs are checked without user action. |
| `notifications` | Tells the user when a solution was pushed to GitHub. The user can turn this off in settings. |
| Host `https://codeforces.com/*` | Reads the user's submission list and the code of their accepted submissions, through the user's logged-in tab. |
| Host `https://leetcode.com/*` | Reads the user's accepted submissions and their code, through the user's logged-in tab. |
| Host `https://www.codechef.com/*` | Reads the user's public submission list and the code of accepted submissions. |
| Host `https://api.github.com/*` | Writes commits to the user's own repository with the user's token. |

## Remote code

No. All code is in the package. The extension loads no remote scripts.

## Data usage (Chrome Web Store privacy tab)

Check these data types:
- **Authentication information**: the GitHub token the user enters.
- **Website content**: the user's own solution code read from the judges.

Leave every other data type unchecked.

Certify all three statements:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

https://github.com/moon-drakon/ac-commit/blob/main/PRIVACY.md

## Homepage and support URLs

- Homepage: https://github.com/moon-drakon/ac-commit
- Support: https://github.com/moon-drakon/ac-commit/issues

## Edge Add-ons extras

- Search terms (up to 7): codeforces, leetcode, codechef, github, competitive programming, commit, sync
- Use the same summary, description, images, and privacy policy URL.
