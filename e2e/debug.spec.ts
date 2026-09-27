import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { expect, makeProject, openProject, quickOpen, test } from './fixtures';

test.setTimeout(180_000);

const PROGRAM = 'x = 41\ny = {"a": [1, 2]}\nx += 1\nprint("value", x)\n';

/** An interpreter on PATH that can import debugpy, if there is one. */
function pythonWithDebugpy(): string | null {
	for (const exe of ['python', 'python3']) {
		try {
			return execFileSync(exe, ['-c', 'import debugpy, sys; print(sys.executable)'], {
				encoding: 'utf8',
				timeout: 30_000,
				windowsHide: true,
			}).trim();
		} catch {
			// Not installed, or no debugpy in it: try the next one.
		}
	}
	return null;
}

/** Otherwise a project .venv with debugpy, made by uv (Anvil picks a folder's .venv itself). */
function uvVenvWithDebugpy(dir: string): boolean {
	try {
		const run = (...args: string[]): void => {
			execFileSync('uv', args, {
				cwd: dir,
				timeout: 120_000,
				windowsHide: true,
				stdio: 'ignore',
			});
		};
		run('venv', '.venv');
		const python = join(
			dir,
			'.venv',
			process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python',
		);
		run('pip', 'install', '--python', python, 'debugpy');
		return true;
	} catch {
		return false;
	}
}

test('stops at a breakpoint, shows a variable, continues to the end', async ({ page }) => {
	const project = makeProject({ 'main.py': PROGRAM });
	try {
		const python = pythonWithDebugpy();
		const venv = python === null && uvVenvWithDebugpy(project.dir);
		test.skip(python === null && !venv, 'needs a Python with debugpy (or uv to install it)');

		await openProject(page, project.dir);
		if (python) {
			const picked = await page.evaluate(
				(p) => window.anvil.invoke('python:select', p),
				python,
			);
			expect(picked.ok).toBe(true);
		}

		await quickOpen(page, 'main.py');
		const editor = page.locator('.monaco-editor').first();
		await expect(editor).toContainText('print("value", x)', { timeout: 30_000 });
		await editor.locator('.view-line').nth(2).click();
		await page.keyboard.press('Control+F9');
		await expect(page.locator('.anvil-bp')).toHaveCount(1);

		await page.keyboard.press('Shift+F9');
		const sidebar = page.locator('[data-part="sidebar"][data-view="debug"]');
		await expect(sidebar.getByText(/Paused on breakpoint/)).toBeVisible({ timeout: 60_000 });
		await expect(page.locator('.anvil-debug-line')).toBeVisible();
		const x = sidebar.getByRole('treeitem').filter({ hasText: /^x\s*=\s*41$/ });
		await expect(x).toBeVisible({ timeout: 20_000 });

		// Evaluate in the paused frame through the Debug Console.
		await page.getByRole('tab', { name: 'Debug Console' }).click();
		const input = page.getByRole('textbox', { name: 'Evaluate in the debugger' });
		await input.fill('x * 2');
		await input.press('Enter');
		await expect(page.getByRole('log', { name: 'Debug Console output' })).toContainText('82');

		await page.keyboard.press('F5');
		await expect(page.getByRole('log', { name: 'Debug Console output' })).toContainText(
			'Program exited with code 0',
			{ timeout: 30_000 },
		);
		await expect(sidebar.getByRole('button', { name: /Debug Python file/ })).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.locator('.anvil-debug-line')).toHaveCount(0);
	} finally {
		project.cleanup();
	}
});
