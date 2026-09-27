import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(180_000);

test('F2 rename reaches files that are not open, which Save All then writes', async ({ page }) => {
	const project = makeProject({
		'lib.py': 'def compute_signal(x):\n    return x\n',
		'main.py': 'from lib import compute_signal\n\nprint(compute_signal(1))\n',
	});
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'lib.py');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(page.locator('[data-lsp-status*="python:ready"]')).toBeVisible({
			timeout: 60_000,
		});
		// "ready" means the client is up; basedpyright still indexes the folder for a moment,
		// and a rename before that only sees the open file.
		await page.waitForTimeout(8_000);

		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Home');
		for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
		// The server answers rename only once it has analysed the file; retry until the box shows.
		await expect(async () => {
			await page.keyboard.press('Escape');
			await page.keyboard.press('F2');
			await expect(page.locator('.rename-box input')).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		const input = page.locator('.rename-box input');
		await expect(input).toBeFocused();
		await input.fill('make_signal');
		await input.press('Enter');

		await expect(page.getByRole('tab', { name: /main\.py/ })).toBeVisible({ timeout: 15_000 });
		await expect(editor.locator('.view-line').first()).toContainText('make_signal');
		await page.keyboard.press('Control+Alt+s');
		await expect
			.poll(() => readFileSync(join(project.dir, 'main.py'), 'utf8'))
			.toBe('from lib import make_signal\n\nprint(make_signal(1))\n');
		expect(readFileSync(join(project.dir, 'lib.py'), 'utf8')).toContain('def make_signal(x):');
	} finally {
		project.cleanup();
	}
});
