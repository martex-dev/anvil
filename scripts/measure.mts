/* eslint-disable no-console -- dev script: results go to the terminal */
/**
 * Measures the packaged app: time to an interactive workbench and idle memory.
 * Usage: npx tsx scripts/measure.mts   (after `npm run dist`)
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron } from '@playwright/test';

const exe = join(import.meta.dirname, '..', 'release', 'win-unpacked', 'Anvil.exe');
const runs: number[] = [];
for (let i = 0; i < 3; i++) {
	const userData = mkdtempSync(join(tmpdir(), 'anvil-measure-'));
	const start = performance.now();
	const app = await electron.launch({
		executablePath: exe,
		args: [`--user-data-dir=${userData}`],
	});
	const page = await app.firstWindow();
	await page.getByRole('navigation', { name: 'Views' }).waitFor();
	runs.push(Math.round(performance.now() - start));
	if (i === 2) {
		await page.waitForTimeout(4000);
		const m = await page.evaluate(() => window.anvil.invoke('app:metrics'));
		console.log('idle', JSON.stringify(m));
	}
	await app.close();
}
console.log('workbench ready (ms):', runs.join(', '));
