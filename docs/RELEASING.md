# Releasing

1. Bump `version` in `package.json` (e.g. `0.2.0`) and commit.
2. Tag and push: `git tag -a v0.2.0 -m "Anvil 0.2.0"` then `git push origin v0.2.0`.
3. The **Release** workflow checks that the tag matches `package.json`, runs typecheck and unit tests, creates the GitHub release, builds the NSIS installer on `windows-latest`, and uploads `Anvil-Setup-<version>.exe`, its `.blockmap` and `latest.yml`.
4. Installed copies see `latest.yml`, download the new installer in the background, and install it on restart (status bar → "Restart to update") or on the next quit.

Before tagging, run `npm run dist` and `npx playwright test e2e/packaged.spec.ts` locally. That smoke test runs the installed layout (asar-unpacked language servers, ripgrep, node-pty), which CI doesn't.

The installer is unsigned (ADR-010), so Windows SmartScreen asks once per new version.
