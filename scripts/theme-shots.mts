/* eslint-disable no-console -- dev script: progress goes to the terminal */
/**
 * Dev helper (not a test): screenshots every color theme plus the theme picker, settings
 * gallery, transform picker and Code Snap, for design review and the README.
 * Usage: npx tsx scripts/theme-shots.mts <demo-folder> <out-dir> [theme-id,...]
 */
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, type Page } from '@playwright/test';

import { THEMES } from '../src/renderer/styles/theme-list';

const demo = process.argv[2];
const outDir = process.argv[3] ?? 'shots';
const only = process.argv[4]?.split(',');
if (!demo) throw new Error('usage: theme-shots.mts <demo-folder> <out-dir> [themes]');
mkdirSync(outDir, { recursive: true });

const app = await electron.launch({
	args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'anvil-theme-shot-'))}`],
	env: { ...process.env, ANVIL_E2E: '1' },
});
const page: Page = await app.firstWindow();
await page.setViewportSize({ width: 1600, height: 960 });
const errors: string[] = [];
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.stack ?? e.message}`));
const shot = async (name: string, wait = 900): Promise<void> => {
	await page.waitForTimeout(wait);
	await page.screenshot({ path: join(outDir, `${name}.png`) });
	console.log('shot', name);
};
const setTheme = (theme: string): Promise<unknown> =>
	page.evaluate((t) => window.anvil.invoke('settings:update', { theme: t }), theme);
const tree = (name: RegExp) => page.getByRole('treeitem', { name }).first();

await page.waitForTimeout(1500);
await page.evaluate((p) => window.anvil.invoke('workspace:open', p), demo);
await page.waitForTimeout(1500);
await tree(/src/).click();
await tree(/lab/).click();
await tree(/strategy\.py/).dblclick();
await page.waitForTimeout(4000);
const editor = page.locator('[data-editor-host]').first();
await editor.click({ position: { x: 420, y: 200 } });

for (const theme of THEMES.filter((t) => !only || only.includes(t.id))) {
	await setTheme(theme.id);
	await shot(`theme-${theme.id}`, 1100);
}
await setTheme('cyber');

// Live preview: arrow twice through the picker.
await page.keyboard.press('Control+Alt+t');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await shot('picker-live-preview', 1200);
await page.keyboard.press('Escape');

await page.keyboard.press('Control+,');
await shot('settings-gallery', 1200);
await page.keyboard.press('Escape');

await editor.click({ position: { x: 420, y: 200 } });
await page.keyboard.press('Control+Alt+x');
await page.keyboard.type('snake');
await shot('transform-picker');
await page.keyboard.press('Escape');

await page.keyboard.press('Control+Alt+c');
await shot('code-snap', 3000);
await page.keyboard.press('Escape');

await page.keyboard.press('Control+Shift+p');
await shot('palette-recent');
await page.keyboard.press('Escape');

console.log('errors:', JSON.stringify(errors.slice(0, 20), null, 1));
await app.close();
