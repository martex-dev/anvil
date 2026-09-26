import { execFileSync } from 'node:child_process';

import { expect, makeProject, openProject, test } from './fixtures';

test.setTimeout(120_000);

test('a new terminal runs commands in the project folder', async ({ page }) => {
	const project = makeProject({ 'marker.txt': 'anvil-terminal-ok\n' });
	try {
		await openProject(page, project.dir);
		await page.keyboard.press('Control+Shift+`');
		const term = page.locator('[data-terminal-status="running"]').first();
		await expect(term).toBeVisible({ timeout: 30_000 });
		// The WebGL renderer draws to a canvas, so read the output stream instead of the DOM.
		await page.evaluate(() => {
			const w = window as unknown as { __out: string };
			w.__out = '';
			window.anvil.on('terminal:data', (m) => {
				w.__out += m.data;
			});
		});
		await term.click();
		await page.keyboard.type('Get-Content marker.txt\r');
		await expect
			.poll(() => page.evaluate(() => (window as unknown as { __out: string }).__out), {
				timeout: 30_000,
			})
			.toContain('anvil-terminal-ok');
	} finally {
		project.cleanup();
	}
});

test('the secret shield blocks a commit that stages a private key', async ({ page }) => {
	const project = makeProject({
		'bot.py': `KEY = "sk-ant-${'x'.repeat(40)}"\n`,
		'ok.py': 'print(1)\n',
	});
	const git = (...args: string[]): string =>
		execFileSync(
			'git',
			['-C', project.dir, '-c', 'user.name=e2e', '-c', 'user.email=e2e@example.com', ...args],
			{
				encoding: 'utf8',
			},
		);
	try {
		git('init', '-q');
		git('add', '-A');
		await openProject(page, project.dir);
		const findings = await page.evaluate(() => window.anvil.invoke('git:scanStaged'));
		expect(findings.ok && findings.data.map((f) => f.kind)).toEqual(['Anthropic API key']);
		// And never the raw key in the renderer.
		expect(JSON.stringify(findings)).not.toContain('x'.repeat(30));

		await page.keyboard.press('Control+Shift+G');
		await page.getByRole('textbox', { name: 'Commit message' }).fill('add bot');
		await page.getByRole('button', { name: /^Commit/ }).click();
		await expect(page.getByText(/Blocked by the secret shield/)).toBeVisible();
		expect(() => git('rev-parse', 'HEAD')).toThrow();
	} finally {
		project.cleanup();
	}
});
