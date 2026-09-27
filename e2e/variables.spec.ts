import { execFileSync } from 'node:child_process';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(180_000);

/** The spec runs a real cell, so it needs a Python Anvil can find. */
function hasPython(): boolean {
	try {
		execFileSync('python', ['-c', 'pass'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

test('running a cell lists its variables in the Variables panel', async ({ page }) => {
	test.skip(!hasPython(), 'no Python on PATH');
	const project = makeProject({
		'research.py': '# %%\nalpha = 0.05\nwindow = [1, 2, 3]\n',
	});
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'research.py');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await editor.locator('.view-line').nth(1).click();
		await page.keyboard.press('Control+Enter');

		await page.getByRole('tab', { name: 'Variables' }).click();
		const table = page.locator('[data-part="variables"]');
		await expect(table.getByRole('row', { name: /alpha/ })).toContainText('0.05', {
			timeout: 60_000,
		});
		await expect(table.getByRole('row', { name: /window/ })).toContainText('3');
	} finally {
		project.cleanup();
	}
});
