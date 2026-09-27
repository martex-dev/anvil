import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, makeProject, openProject, test } from './fixtures';

test.setTimeout(120_000);

test('explorer creates nested paths and copies, cuts and pastes files', async ({ page }) => {
	const project = makeProject({ 'src/a.py': 'x = 1\n', 'out/.keep': '' });
	try {
		await openProject(page, project.dir);
		const tree = page.getByRole('tree', { name: 'Files' });

		// A nested name creates the folders on the way and reveals the new file.
		await page.getByRole('button', { name: 'New File', exact: true }).click();
		await page.keyboard.type('pkg/models/net.py');
		await page.keyboard.press('Enter');
		await expect(tree.locator('[data-path="pkg/models/net.py"]')).toBeVisible();
		expect(existsSync(join(project.dir, 'pkg', 'models', 'net.py'))).toBe(true);

		// Copy src/a.py, paste into out/.
		await tree.locator('[data-path="src"]').click();
		await tree.locator('[data-path="src/a.py"]').click();
		await tree.focus();
		await page.keyboard.press('Control+c');
		await tree.locator('[data-path="out"]').click();
		await tree.focus();
		await page.keyboard.press('Control+v');
		await expect(tree.locator('[data-path="out/a.py"]')).toBeVisible();
		expect(existsSync(join(project.dir, 'src', 'a.py'))).toBe(true);

		// Cut it again and paste into pkg/: it moves.
		await tree.focus();
		await page.keyboard.press('Control+x');
		await tree.locator('[data-path="pkg"]').click();
		await tree.focus();
		await page.keyboard.press('Control+v');
		await expect(tree.locator('[data-path="pkg/a.py"]')).toBeVisible();
		await expect.poll(() => existsSync(join(project.dir, 'out', 'a.py'))).toBe(false);
	} finally {
		project.cleanup();
	}
});
