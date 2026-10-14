# 05: QA runs locally on macOS with one command and never touches the party Room

**What to build:** QA targets the working copy on the local server by default, runs on macOS without Linux-only paths, has no known flaky script, and only writes to isolated test Rooms that can be cleaned up.

**Blocked by:** 04 — Editor survives peer writes; Room strings cannot inject HTML

**Status:** done

- [x] Default target `http://127.0.0.1:8765/` (`qaBase()` in qa-lib); live Pages only via `QA_URL`
- [x] No `/opt/cursor/artifacts` or `/usr/bin/google-chrome-stable` hardcode: `artifactDir()` → `QA_OUT` / `qa-artifacts/<script>` / tmp; `chromePath()` → `CHROME` / installed Chrome / Playwright Chromium
- [x] `qa-dual-award`: seeded Rooms with and without Challenges (red 2/2 before), race fires both handlers at once (green 3/3)
- [x] `assertTestRoom`: only `qa-` / `review-` Room ids; wipe Rooms renamed `diag-wipe-` → `qa-wipe-`; ids recorded in `qa-artifacts/rooms.txt`
- [x] `npm run qa` (wipe + qa) starts/stops the local server and prints a summary; `npm run qa:rooms` dry run / `--delete`
- [x] README: one-command QA on macOS, test Rooms clean-up
