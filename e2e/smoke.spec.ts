import { expect, test } from './fixtures';

test('launches with the Anvil title, the welcome tab and the workbench', async ({ page }) => {
	await expect(page).toHaveTitle('Anvil');
	await expect(page.getByRole('tab', { name: /Welcome/ })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Views' })).toBeVisible();
	await expect(page.getByLabel('AI assistant').first()).toBeVisible();
});

test('renderer has no Node globals, only the typed bridge', async ({ page }) => {
	const globals = await page.evaluate(() => {
		const w = window as unknown as Record<string, unknown>;
		return {
			require: typeof w['require'],
			process: typeof w['process'],
			anvil: typeof w['anvil'],
		};
	});
	expect(globals).toEqual({ require: 'undefined', process: 'undefined', anvil: 'object' });
});

test('navigating to an external URL is blocked', async ({ page }) => {
	const before = page.url();
	await page.evaluate(() => {
		window.location.href = 'https://example.com/';
	});
	await page.waitForTimeout(1000);
	expect(page.url()).toBe(before);
});

test('a strict CSP is present', async ({ page }) => {
	const csp = await page
		.locator('meta[http-equiv="Content-Security-Policy"]')
		.getAttribute('content');
	expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
	expect(csp).not.toContain("'unsafe-eval'");
	expect(csp).toContain("object-src 'none'");
});

test('IPC rejects invalid input and there is no way to read a secret back', async ({ page }) => {
	const bad = await page.evaluate(() =>
		window.anvil.invoke('fs:readFile', 42 as unknown as string),
	);
	expect(bad).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
	const unknown = await page.evaluate(() =>
		(window.anvil.invoke as (c: string, i?: unknown) => Promise<unknown>)(
			'secrets:get',
			'anthropic.key',
		),
	);
	expect(unknown).toMatchObject({ ok: false, error: { code: 'UNKNOWN_CHANNEL' } });
});

test('command palette lists commands and runs one', async ({ page }) => {
	await page.keyboard.press('Control+Shift+P');
	const input = page.getByPlaceholder('Type a command…');
	await expect(input).toBeVisible();
	await input.fill('toggle zen');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('navigation', { name: 'Views' })).toHaveCount(0);
	await page.keyboard.press('Control+Alt+z');
	await expect(page.getByRole('navigation', { name: 'Views' })).toBeVisible();
});
