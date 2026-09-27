import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(120_000);

/** ruff on PATH (the env Anvil picks usually has it too); the spec needs a real ruff server. */
function hasRuff(): boolean {
	try {
		execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['ruff']);
		return true;
	} catch {
		return false;
	}
}

test('ruff reports lint problems and Organize Imports sorts them', async ({ page }) => {
	test.skip(!hasRuff(), 'ruff is not installed');
	const project = makeProject({
		'sig.py': 'import sys\nimport os\nimport json\n\nprint(sys.argv, os.sep)\n',
	});
	try {
		await openProject(page, project.dir);
		await quickOpen(page, 'sig.py');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(page.locator('[data-lsp-status*="ruff:ready"]')).toBeVisible({
			timeout: 60_000,
		});

		// F401: `json` is imported but unused.
		await page.keyboard.press('Control+Shift+m');
		await expect(page.getByRole('tree', { name: 'Problems' })).toContainText(/F401|json/, {
			timeout: 30_000,
		});

		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Control+Shift+p');
		await page.keyboard.type('Organize Imports');
		await page.keyboard.press('Enter');
		// The code action applies asynchronously; save once the buffer shows it.
		await expect(editor.locator('.view-line').first()).toContainText('import json', {
			timeout: 15_000,
		});
		await page.keyboard.press('Control+s');
		// Sorted by ruff's isort rules (sorting only: removing `json` is a separate fix).
		await expect
			.poll(() => readFileSync(join(project.dir, 'sig.py'), 'utf8'), { timeout: 15_000 })
			.toMatch(/^import json\r?\nimport os\r?\nimport sys\r?\n/);
	} finally {
		project.cleanup();
	}
});
