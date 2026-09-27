import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(120_000);

test('replace in files edits open buffers in place and other files on disk', async ({ page }) => {
	const project = makeProject({
		'open.py': 'price = 1\n',
		'closed.py': 'price = 2\nprice_feed()\n',
	});
	const read = (name: string): string => readFileSync(join(project.dir, name), 'utf8');
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'open.py');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });

		await page.keyboard.press('Control+Shift+H');
		const replaceBox = page.getByRole('textbox', { name: 'Replace with' });
		await expect(replaceBox).toBeFocused();
		await replaceBox.fill('cost');
		await page.getByRole('textbox', { name: 'Search in files' }).fill('price');
		await page.getByRole('button', { name: 'Whole word' }).click();
		await expect(page.locator('[data-search-summary]')).toContainText('2 results in 2 files');

		await page.getByRole('button', { name: /Replace All/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Replace All' }).click();

		// The unopened file is rewritten on disk, whole words only.
		await expect.poll(() => read('closed.py')).toBe('cost = 2\nprice_feed()\n');
		// The open file changes in its tab, unsaved: the disk still has the old text. (\s: Monaco
		// renders spaces as no-break spaces.)
		await expect(editor.locator('.view-line').first()).toHaveText(/cost\s=\s1/);
		await expect(
			page.getByRole('tab', { name: /open\.py/ }).getByRole('button', { name: /unsaved/ }),
		).toBeVisible();
		expect(read('open.py')).toBe('price = 1\n');

		// And one undo takes the replacement back.
		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Control+z');
		await expect(editor.locator('.view-line').first()).toHaveText(/price\s=\s1/);
	} finally {
		project.cleanup();
	}
});
