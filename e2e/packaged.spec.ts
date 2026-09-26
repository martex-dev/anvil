import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

import { makeProject, openProject, quickOpen } from './fixtures';

const EXE = join(__dirname, '..', 'release', 'win-unpacked', 'Anvil.exe');

// Runs only after `npm run dist`: checks the installed layout (asar-unpacked language servers,
// ripgrep, node-pty) actually works, which the dev build can't prove.
test.skip(!existsSync(EXE), 'no packaged build; run `npm run dist` first');
test.setTimeout(150_000);

test('packaged app: language server, search and terminal work from the installed layout', async () => {
	const userData = mkdtempSync(join(tmpdir(), 'anvil-packaged-'));
	const project = makeProject({
		'app.py': 'import os\n\nvalue: int = "oops"\n',
		'notes.md': 'needle\n',
	});
	const app = await electron.launch({
		executablePath: EXE,
		args: [`--user-data-dir=${userData}`],
		env: { ...process.env, ANVIL_E2E: '1' },
	});
	try {
		const page = await app.firstWindow();
		await expect(page).toHaveTitle('Anvil');
		await openProject(page, project.dir);

		const search = await page.evaluate(() =>
			window.anvil.invoke('search:run', { query: 'needle' }),
		);
		expect(search.ok && search.data.matchCount).toBe(1);

		await quickOpen(page, 'app');
		await expect(page.locator('[data-editor-host] .monaco-editor').first()).toBeVisible({
			timeout: 45_000,
		});
		// basedpyright flags the bad annotation once it's up.
		await expect(page.locator('[data-lsp-status*="python:ready"]')).toBeVisible({
			timeout: 60_000,
		});
		await expect(page.locator('.squiggly-error').first()).toBeAttached({ timeout: 60_000 });

		await page.keyboard.press('Control+Shift+`');
		await expect(page.locator('[data-terminal-status="running"]').first()).toBeVisible({
			timeout: 30_000,
		});
	} finally {
		await app.close();
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		project.cleanup();
	}
});
