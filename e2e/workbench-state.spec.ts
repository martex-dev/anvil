import { expect, makeProject, openProject, test } from './fixtures';

test.setTimeout(120_000);

test('side views and the panel keep their state while hidden', async ({ page }) => {
	const project = makeProject({ 'src/a.py': 'x = 1\n', 'README.md': '# hi\n' });
	try {
		await openProject(page, project.dir);
		const tree = page.getByRole('tree', { name: 'Files' });
		await tree.locator('[data-path="src"]').click();
		await expect(tree.locator('[data-path="src/a.py"]')).toBeVisible();

		// Another side view and back: the folder is still open.
		await page.getByRole('button', { name: 'Search', exact: true }).click();
		await expect(tree).toBeHidden();
		await page.getByRole('button', { name: 'Explorer', exact: true }).click();
		await expect(tree.locator('[data-path="src/a.py"]')).toBeVisible();

		// Closing the panel keeps the terminal's xterm alive instead of rebuilding it on reopen.
		await page.keyboard.press('Control+Shift+`');
		const term = page.locator('[data-terminal-status="running"]').first();
		await expect(term).toBeVisible({ timeout: 30_000 });
		await term.locator('.xterm').evaluate((el) => el.setAttribute('data-e2e-mark', '1'));
		// Ctrl+` (not Ctrl+J, which the terminal keeps for TUIs) hides the panel from inside it.
		await page.keyboard.press('Control+Backquote');
		await expect(term).toBeHidden();
		await page.keyboard.press('Control+Backquote');
		await expect(term).toBeVisible();
		await expect(term.locator('.xterm[data-e2e-mark="1"]')).toHaveCount(1);
	} finally {
		project.cleanup();
	}
});
