import { execFileSync } from 'node:child_process';

import type { Page } from '@playwright/test';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(180_000);

/** An interpreter Anvil found that can import pytest (ADR-004: Anvil ships none), or null. */
async function pythonWithPytest(page: Page): Promise<string | null> {
	const envs = await page.evaluate(() => window.anvil.invoke('python:envs', { refresh: true }));
	if (!envs.ok) return null;
	for (const env of envs.data) {
		try {
			execFileSync(env.path, ['-c', 'import pytest'], { stdio: 'ignore', timeout: 30_000 });
			return env.path;
		} catch {
			// This one has no pytest; try the next.
		}
	}
	return null;
}

test('the Test Explorer discovers, runs and marks pytest tests', async ({ page }) => {
	const project = makeProject({
		'tests/test_calc.py': [
			'def test_adds():',
			'    assert 1 + 1 == 2',
			'',
			'',
			'def test_breaks():',
			'    assert 1 + 1 == 3',
			'',
		].join('\n'),
	});
	try {
		await openProject(page, project.dir);
		const python = await pythonWithPytest(page);
		test.skip(python === null, 'No interpreter with pytest installed on this machine');
		const picked = await page.evaluate((p) => window.anvil.invoke('python:select', p), python);
		expect(picked.ok).toBe(true);

		await page.getByRole('button', { name: 'Tests', exact: true }).click();
		const tree = page.getByRole('tree', { name: 'Tests' });
		await expect(tree).toBeVisible({ timeout: 60_000 });
		const pass = tree.locator('[data-test-id="tests/test_calc.py::test_adds"]');
		const fail = tree.locator('[data-test-id="tests/test_calc.py::test_breaks"]');
		await expect(pass).toHaveAttribute('data-status', 'none');
		await expect(fail).toHaveAttribute('data-status', 'none');

		await page.getByRole('button', { name: 'Run All Tests' }).click();
		await expect(pass).toHaveAttribute('data-status', 'passed', { timeout: 60_000 });
		await expect(fail).toHaveAttribute('data-status', 'failed');
		await expect(tree.locator('[data-test-id="tests/test_calc.py"]')).toHaveAttribute(
			'data-status',
			'failed',
		);
		await expect(page.locator('[data-count="passed"]')).toContainText('1');
		await expect(page.locator('[data-count="failed"]')).toContainText('1');
		await expect(page.locator('[data-tests-status="failed"]')).toBeVisible();

		// The failure's message and a clickable location in the details area.
		await fail.click();
		const details = page.getByRole('region', { name: 'Test details' });
		await expect(details).toContainText(/assert \(?1 \+ 1\)? == 3/);
		await expect(
			details.getByRole('button', { name: /test_calc\.py:6/ }).first(),
		).toBeVisible();

		// The editor shows a run lens above each test, marked with the last result.
		await quickOpen(page, 'test_calc');
		await expect(page.locator('.codelens-decoration').first()).toContainText('Run test', {
			timeout: 30_000,
		});
	} finally {
		project.cleanup();
	}
});
