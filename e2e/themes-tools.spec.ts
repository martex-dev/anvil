import type { Page } from '@playwright/test';

import { expect, makeProject, openProject, test } from './fixtures';

test.setTimeout(120_000);

const lines = (page: Page): Promise<string> =>
	page
		.locator('[data-editor-host] .monaco-editor .view-lines')
		.first()
		.innerText()
		// Monaco renders spaces as no-break spaces.
		.then((t) => t.replaceAll(String.fromCharCode(160), ' '));

test('theme picker previews live and Esc restores the saved theme', async ({ page }) => {
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'cyber');
	await page.keyboard.press('Control+Alt+t');
	await page.keyboard.press('ArrowDown');
	await expect(html).toHaveAttribute('data-theme', 'synthwave');
	await page.keyboard.press('Escape');
	await expect(html).toHaveAttribute('data-theme', 'cyber');

	await page.keyboard.press('Control+Alt+t');
	await page.keyboard.type('nord');
	await page.keyboard.press('Enter');
	await expect(html).toHaveAttribute('data-theme', 'nord');
	const saved = await page.evaluate(() => window.anvil.invoke('settings:get', undefined));
	expect(saved.ok && saved.data.theme).toBe('nord');
});

test('scratchpad survives edits, math and transforms', async ({ page }) => {
	const project = makeProject({ 'a.py': 'x = 1\n' });
	try {
		await openProject(page, project.dir);
		await page.keyboard.press('Control+Alt+p');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('price = 1.5k\nprice * 20 * 2%\nmyVariableName');

		// Evaluate the first two lines: the expression line becomes its value.
		await page.keyboard.press('Control+Home');
		await page.keyboard.press('Shift+ArrowDown');
		await page.keyboard.press('Shift+End');
		await page.keyboard.press('Control+Alt+Equal');
		await expect.poll(() => lines(page)).toContain('600');

		// Cursor moves used to let VS Code's reference counting dispose the in-memory model.
		await page.keyboard.press('Control+End');
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Home');
		await page.keyboard.press('Shift+End');
		await page.keyboard.press('Control+Alt+x');
		await page.keyboard.type('snake_case');
		await page.keyboard.press('Enter');
		await expect.poll(() => lines(page)).toContain('my_variable_name');
		await expect(editor).toBeVisible();
	} finally {
		project.cleanup();
	}
});
