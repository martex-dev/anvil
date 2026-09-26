/* eslint-disable no-console -- dev script: progress goes to the terminal */
/**
 * Dev helper (not a test): screenshots skins and their palettes on the built app, for design
 * review and the README.
 *   npx tsx scripts/skin-shots.mts <demo-folder> <out-dir> [targets] [--extras]
 * targets: comma list of `skin` (its default palette), `skin:palette`, or `skin:*` (every
 * palette). Default: every skin. --extras adds the pickers, settings, Code Snap and palette.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, type Page } from '@playwright/test';

const [demo, outDir = 'shots', targetArg] = process.argv
	.slice(2)
	.filter((a) => !a.startsWith('--'));
const extras = process.argv.includes('--extras');
if (!demo) throw new Error('usage: skin-shots.mts <demo-folder> <out-dir> [targets] [--extras]');
mkdirSync(outDir, { recursive: true });

// Skins are folders with a manifest; palette ids are read from the manifest source.
const skinsDir = join('src', 'renderer', 'skins');
const skins = readdirSync(skinsDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);
const palettesOf = (skin: string): string[] => {
	const src = readFileSync(join(skinsDir, skin, 'manifest.ts'), 'utf8');
	const block = /palettes:\s*\[([\s\S]*?)\],\s*\n\s*fonts:/.exec(src)?.[1] ?? '';
	return [...block.matchAll(/id:\s*'([\w-]+)'/g)].map((m) => m[1] ?? '');
};
const targets: Array<{ skin: string; palette?: string }> = (targetArg?.split(',') ?? skins).flatMap(
	(t) => {
		const [skin = '', palette] = t.split(':');
		if (palette === '*') return palettesOf(skin).map((p) => ({ skin, palette: p }));
		return [palette ? { skin, palette } : { skin }];
	},
);

const app = await electron.launch({
	args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'anvil-skin-shot-'))}`],
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
const update = (patch: Record<string, unknown>): Promise<unknown> =>
	page.evaluate((p) => window.anvil.invoke('settings:update', p), patch);
const tree = (name: RegExp) => page.getByRole('treeitem', { name }).first();

await page.waitForTimeout(1500);
await page.evaluate((p) => window.anvil.invoke('workspace:open', p), demo);
await page.waitForTimeout(1500);
await tree(/src/).click();
await tree(/lab/).click();
await tree(/strategy\.py/).dblclick();
await page.waitForTimeout(4000);
await page
	.locator('[data-editor-host]')
	.first()
	.click({ position: { x: 420, y: 200 } });

for (const { skin, palette } of targets) {
	await update({ skin, skinPrefs: palette ? { [skin]: { palette } } : {} });
	await shot(palette ? `skin-${skin}-${palette}` : `skin-${skin}`, 1400);
}

if (extras) {
	await update({ skin: 'cyber', skinPrefs: {} });
	await page.keyboard.press('Control+Alt+y');
	await page.keyboard.press('ArrowDown');
	await shot('skin-picker', 1400);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Control+,');
	await shot('settings-appearance', 1400);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Control+Alt+c');
	await shot('code-snap', 3000);
	await page.keyboard.press('Escape');
}

console.log('errors:', JSON.stringify(errors.slice(0, 20), null, 1));
await app.close();
