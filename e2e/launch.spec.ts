import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

import { closeDiscardingUnsaved, makeProject } from './fixtures';

test.setTimeout(120_000);

/** Starts Anvil the way `Anvil.exe <path>` or Explorer's "Open with Anvil" would. */
async function launchWith(path: string, userData: string) {
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userData}`, path],
		env: { ...process.env, ANVIL_E2E: '1' },
	});
	const page = await app.firstWindow();
	await page.waitForLoadState('domcontentloaded');
	return { app, page };
}

test('a folder on the command line opens as the workspace', async () => {
	const project = makeProject({ 'hello.py': 'print(1)\n' });
	const userData = mkdtempSync(join(tmpdir(), 'anvil-e2e-'));
	const { app, page } = await launchWith(project.dir, userData);
	try {
		await expect(page.getByRole('tree', { name: 'Files' })).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText('hello.py').first()).toBeVisible();
	} finally {
		await closeDiscardingUnsaved(app);
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		project.cleanup();
	}
});

test('a file on the command line opens in its folder, in a tab', async () => {
	const project = makeProject({ 'src/signal.py': 'def signal(x):\n    return x\n' });
	const userData = mkdtempSync(join(tmpdir(), 'anvil-e2e-'));
	const { app, page } = await launchWith(join(project.dir, 'src', 'signal.py'), userData);
	try {
		await expect(page.getByRole('tab', { name: /signal\.py/ })).toBeVisible({
			timeout: 45_000,
		});
		await expect(page.locator('[data-editor-host] .monaco-editor').first()).toBeVisible({
			timeout: 45_000,
		});
	} finally {
		await closeDiscardingUnsaved(app);
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		project.cleanup();
	}
});
