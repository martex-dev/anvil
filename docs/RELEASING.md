# Releasing

1. Bump `version` in `package.json` and the two top-level `version` fields in `package-lock.json` (e.g. `0.3.1`), and add a `## [0.3.1] - <date>` section at the top of `CHANGELOG.md`. Commit as `chore(release): 0.3.1`.
2. Merge it to `main`. That's the release: no tag to push.
3. On every push to `main`, the **Release** workflow compares `package.json` with the repo's tags. When `v<version>` doesn't exist yet it runs typecheck and unit tests, tags the commit, creates the GitHub release, builds the NSIS installer on `windows-latest`, and uploads `Anvil-Setup-<version>.exe`, its `.blockmap` and `latest.yml`. The notes are every `CHANGELOG.md` section newer than the previous release. A push that doesn't change the version stops after one step.
4. Installed copies check 1 minute after launch, every 6 hours, and on waking from sleep when the last check is over 30 minutes old. They download the new installer in the background and install it on restart (status bar → "Restart to update") or on the next quit. Settings → Updates turns this off or checks now.

Pushing a `v*` tag by hand still works; it must match `package.json`. Only the highest version is marked **Latest**, which is what installed copies update to, so publishing an older version late can't send users backwards.

Before a release, run `npm run dist` and `npx playwright test e2e/packaged.spec.ts` locally. That smoke test runs the installed layout (asar-unpacked language servers, ripgrep, node-pty), which CI doesn't.

The installer is unsigned (ADR-010), so Windows SmartScreen asks once per new version.
