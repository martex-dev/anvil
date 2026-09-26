/* eslint-disable no-console -- dev script: progress goes to the terminal */
/**
 * Dev helper (not a test): launches the built app on a demo folder and saves screenshots of
 * the main surfaces, for design review and the README.
 * Usage: npx tsx scripts/shots.mts <demo-folder> <out-dir> [only-prefix]
 */
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, type Page } from '@playwright/test';

const demo = process.argv[2];
const outDir = process.argv[3] ?? 'shots';
if (!demo) throw new Error('usage: shots.mts <demo-folder> <out-dir>');
mkdirSync(outDir, { recursive: true });

const userDataDir = mkdtempSync(join(tmpdir(), 'anvil-shot-'));
const app = await electron.launch({
	args: ['.', `--user-data-dir=${userDataDir}`],
	env: { ...process.env, ANVIL_E2E: '1' },
});
const page: Page = await app.firstWindow();
await page.setViewportSize({ width: 1600, height: 960 });
const errors: string[] = [];
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const shot = async (name: string, wait = 900): Promise<void> => {
	await page.waitForTimeout(wait);
	await page.screenshot({ path: join(outDir, `${name}.png`) });
	console.log('shot', name);
};
const tree = (name: RegExp) => page.getByRole('treeitem', { name }).first();

await page.waitForTimeout(1500);
await page.evaluate((p) => window.anvil.invoke('workspace:open', p), demo);
await page.waitForTimeout(1500);
await tree(/src/).click();
await tree(/lab/).click();
await tree(/strategy\.py/).dblclick();
await page.waitForTimeout(4000);
await shot('10-editor');

// Run the first `# %%` cell in the REPL.
await page
	.locator('[data-editor-host]')
	.first()
	.click({ position: { x: 300, y: 180 } });
await page.keyboard.press('Control+Enter');
await shot('11-repl', 12000);

await page.keyboard.press('Control+\\');
await shot('12-split', 2000);

await page.keyboard.press('Control+p');
await page.keyboard.type('rsk');
await shot('13-quickopen');
await page.keyboard.press('Escape');

await page.keyboard.press('Control+,');
await shot('14-settings');
await page.keyboard.press('Escape');

await page.keyboard.press('Control+Shift+G');
await shot('15-git', 2500);

await page.keyboard.press('Control+Alt+z');
await shot('16-zen', 1200);
await page.keyboard.press('Control+Alt+z');

console.log('errors:', JSON.stringify(errors.slice(0, 20), null, 1));
await app.close();
