import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	_electron as electron,
	type ElectronApplication,
	type Page,
	test as base,
} from '@playwright/test';

interface AnvilFixtures {
	app: ElectronApplication;
	page: Page;
	userDataDir: string;
}

// Each test gets a throwaway userData dir so runs never touch your real settings.
export const test = base.extend<AnvilFixtures>({
	// Playwright parses the first param's destructuring to resolve fixture deps; `{}` means none.
	// eslint-disable-next-line no-empty-pattern
	userDataDir: async ({}, use) => {
		const dir = mkdtempSync(join(tmpdir(), 'anvil-e2e-'));
		await use(dir);
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	},
	app: async ({ userDataDir }, use) => {
		const app = await electron.launch({
			args: ['.', `--user-data-dir=${userDataDir}`],
			env: { ...process.env, ANVIL_E2E: '1' },
		});
		await use(app);
		await app.close();
	},
	page: async ({ app }, use) => {
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await use(page);
	},
});

export { expect } from '@playwright/test';

/** A throwaway project folder with the given files ('/'-separated paths). */
export function makeProject(files: Record<string, string>): { dir: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), 'anvil-proj-'));
	for (const [rel, content] of Object.entries(files)) {
		const abs = join(dir, ...rel.split('/'));
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, content);
	}
	return {
		dir,
		cleanup: () => {
			try {
				rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
			} catch {
				// A shell started in the folder can still hold it on Windows; %TEMP% gets cleaned anyway.
			}
		},
	};
}

/** Opens a folder through IPC and waits for the explorer to show it. */
export async function openProject(page: Page, dir: string): Promise<void> {
	await page.evaluate((p) => window.anvil.invoke('workspace:open', p), dir);
	await page.getByRole('tree', { name: 'Files' }).waitFor({ timeout: 20_000 });
}

/** Opens a file with Quick Open (Ctrl+P), like a user would. */
export async function quickOpen(page: Page, query: string): Promise<void> {
	await page.keyboard.press('Control+p');
	await page.getByPlaceholder(/Search files/).fill(query);
	await page.getByRole('option').first().waitFor();
	await page.keyboard.press('Enter');
}
