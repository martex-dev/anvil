import { expect, test } from './fixtures';

test('renderer has no Node globals', async ({ page }) => {
	const globals = await page.evaluate(() => {
		const w = window as unknown as Record<string, unknown>;
		return { require: typeof w['require'], process: typeof w['process'] };
	});
	expect(globals).toEqual({ require: 'undefined', process: 'undefined' });
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
