import { expect, test } from './fixtures';

test.setTimeout(120_000);

const SKINS = ['cyber', 'mainframe', 'concrete', 'cockpit', 'workbench', 'holo', 'zen', 'y2k'];

test('skin picker previews live, Esc restores, Enter keeps', async ({ page }) => {
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-skin', 'cyber');

	await page.keyboard.press('Control+Alt+y');
	await page.keyboard.type('mainframe');
	await expect(html).toHaveAttribute('data-skin', 'mainframe');
	await page.keyboard.press('Escape');
	await expect(html).toHaveAttribute('data-skin', 'cyber');

	await page.keyboard.press('Control+Alt+y');
	await page.keyboard.type('workbench');
	await page.keyboard.press('Enter');
	await expect(html).toHaveAttribute('data-skin', 'workbench');
	const saved = await page.evaluate(() => window.anvil.invoke('settings:get', undefined));
	expect(saved.ok && saved.data.skin).toBe('workbench');
});

test('every skin renders the workbench with working window buttons', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => {
		// Monaco's TextMate worker can race a light/dark retokenize (ADR-011); not a skin fault.
		if (!e.stack?.includes('TokenizationSupportWithLineLimit')) errors.push(e.message);
	});
	for (const skin of SKINS) {
		await page.evaluate((id) => window.anvil.invoke('settings:update', { skin: id }), skin);
		await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
		await expect(page.locator('[data-part="workbench"]')).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Close', exact: true }).first(),
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: /^(Maximize|Restore)$/ }).first(),
		).toBeVisible();
	}
	expect(errors).toEqual([]);
});

test('color variants belong to the active skin', async ({ page }) => {
	await page.evaluate(() => window.anvil.invoke('settings:update', { skin: 'mainframe' }));
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', /^mf-/);
	await page.keyboard.press('Control+Alt+t');
	await page.keyboard.press('ArrowDown');
	await expect(html).toHaveAttribute('data-theme', /^mf-/);
	await page.keyboard.press('Enter');
	const saved = await page.evaluate(() => window.anvil.invoke('settings:get', undefined));
	expect(saved.ok && saved.data.skinPrefs['mainframe']?.palette).toMatch(/^mf-/);
});
