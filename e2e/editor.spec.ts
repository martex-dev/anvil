import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(120_000);

test('open with Quick Open, edit, save, and keep a local-history snapshot', async ({ page }) => {
	const project = makeProject({
		'src/signal.py': 'def signal(x):\n\treturn x\n',
		'README.md': '# demo\n',
	});
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'sig');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(page.getByRole('tab', { name: /signal\.py/ })).toBeVisible();

		await editor.locator('.view-line').nth(1).click();
		await page.keyboard.press('End');
		await page.keyboard.type(' * 2');
		await expect(
			page.getByRole('tab', { name: /signal\.py/ }).getByRole('button', { name: /unsaved/ }),
		).toBeVisible();
		await page.keyboard.press('Control+s');
		await expect
			.poll(() => readFileSync(join(project.dir, 'src', 'signal.py'), 'utf8'))
			.toContain('return x * 2');

		// The snapshot is written right after the file, in the same save call.
		await expect
			.poll(async () => {
				const history = await page.evaluate(() =>
					window.anvil.invoke('history:list', 'src/signal.py'),
				);
				return history.ok ? history.data.length : -1;
			})
			.toBe(1);
	} finally {
		project.cleanup();
	}
});

test('split editor, outline and cells in a Python file', async ({ page }) => {
	const project = makeProject({
		'lab.py':
			'import math\n\n# %% Load\nx = 1\n\n# %% Model\nclass Model:\n\tdef fit(self):\n\t\treturn math.pi\n',
	});
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'lab');
		await expect(page.locator('[data-editor-host] .monaco-editor').first()).toBeVisible({
			timeout: 45_000,
		});
		await page.keyboard.press('Control+\\');
		await expect(page.getByRole('region', { name: /Editor group 2/ })).toBeVisible();

		await page
			.getByRole('navigation', { name: 'Views' })
			.getByRole('button', { name: 'Outline & Bookmarks' })
			.click();
		const outline = page.getByRole('tree', { name: 'Outline' });
		await expect(outline).toContainText('Model');
		await expect(outline).toContainText('fit');
		await expect(outline).toContainText('Load');
		await expect(page.locator('.anvil-cell-glyph').first()).toBeAttached();
	} finally {
		project.cleanup();
	}
});

test('CSV opens in the data viewer', async ({ page }) => {
	const rows = [
		'date,symbol,close',
		...Array.from(
			{ length: 120 },
			(_, i) => `2024-01-${String((i % 28) + 1).padStart(2, '0')},BTC,${40000 + i}`,
		),
	];
	const project = makeProject({ 'prices.csv': `${rows.join('\n')}\n` });
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'prices');
		await expect(page.getByText(/120 rows × 3 cols/)).toBeVisible({ timeout: 20_000 });
		await expect(page.getByRole('grid')).toContainText('40000');
	} finally {
		project.cleanup();
	}
});
