import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

import { makeProject, openProject, quickOpen } from './fixtures';

test.setTimeout(180_000);

const ORIGINAL = 'def add(a, b):\n\treturn a - b\n\n\nprint(add(1, 2))\n';

interface Captured {
	apiKey: string;
	body: {
		system: string;
		model: string;
		stream?: boolean;
		messages: Array<{ role: string; content: string }>;
	};
}

/**
 * Speaks the Anthropic Messages API: streaming SSE for chat and inline edit, plain JSON for the
 * one-shot autocomplete request.
 */
function mockAnthropic(captured: Captured[]): Server {
	return createServer((req, res) => {
		let raw = '';
		req.on('data', (c: Buffer) => (raw += c.toString('utf8')));
		req.on('end', () => {
			const body = JSON.parse(raw) as Captured['body'];
			captured.push({ apiKey: String(req.headers['x-api-key'] ?? ''), body });
			if (!body.stream) {
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end(
					JSON.stringify({
						content: [{ type: 'text', text: '<completion>a + b  # ghost' }],
					}),
				);
				return;
			}
			const edit = body.system.includes('ONLY the code that replaces');
			const reply = edit
				? ['```python\n', 'def add(a, b):\n', '\treturn a + b\n', '```']
				: [
						'The subtraction is a bug. Fixed:\n',
						'```python\ndef add(a, b):\n',
						'\treturn a + b\n```\n',
						'That returns **3**.',
					];
			res.writeHead(200, { 'content-type': 'text/event-stream' });
			const events = [
				[
					'message_start',
					{ type: 'message_start', message: { usage: { input_tokens: 42 } } },
				],
				...reply.map((text) => [
					'content_block_delta',
					{ type: 'content_block_delta', delta: { type: 'text_delta', text } },
				]),
				['message_delta', { type: 'message_delta', usage: { output_tokens: 17 } }],
				['message_stop', { type: 'message_stop' }],
			] as const;
			let i = 0;
			const next = (): void => {
				const e = events[i++];
				if (!e) return void res.end();
				res.write(`event: ${e[0]}\ndata: ${JSON.stringify(e[1])}\n\n`);
				setTimeout(next, 30);
			};
			next();
		});
	});
}

test('AI: chat with selection, apply via diff, inline edit, ghost text', async () => {
	const captured: Captured[] = [];
	const server = mockAnthropic(captured);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;
	const userData = mkdtempSync(join(tmpdir(), 'anvil-ai-'));
	const project = makeProject({ 'calc.py': ORIGINAL });
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userData}`],
		env: { ...process.env, ANVIL_E2E: '1', ANVIL_AI_API: `http://127.0.0.1:${port}` },
	});
	try {
		const page = await app.firstWindow();
		await openProject(page, project.dir);
		await quickOpen(page, 'calc');
		const editor = page.locator('[data-editor-host] .monaco-editor').first();
		await expect(editor).toBeVisible({ timeout: 45_000 });

		const chat = page.locator('[data-ai-chat]');
		await expect(chat.getByText('No Claude API key yet.')).toBeVisible();
		await page.evaluate(() =>
			window.anvil.invoke('secrets:set', { key: 'anthropic.key', value: 'sk-ant-test' }),
		);
		await expect(chat.getByText('No Claude API key yet.')).toHaveCount(0);

		// Select the function and attach it.
		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Home');
		await page.keyboard.press('Shift+ArrowDown');
		await page.keyboard.press('Shift+End');
		await chat.getByRole('button', { name: 'Selection' }).click();
		await expect(chat.locator('[data-attached="selection"]')).toContainText('calc.py:1-2');

		await chat.getByRole('textbox', { name: 'Message' }).fill('Why does add() return -1?');
		await page.keyboard.press('Enter');
		const reply = chat.locator('[data-chat-role="assistant"]').last();
		await expect(reply).toHaveAttribute('data-streaming', 'false', { timeout: 20_000 });
		await expect(reply.locator('strong', { hasText: '3' })).toBeVisible();
		await expect(reply).toContainText('42 in / 17 out');
		const first = captured[0];
		expect(first?.apiKey).toBe('sk-ant-test');
		expect(first?.body.model).toBe('claude-opus-5');
		expect(first?.body.system).toContain('label="calc.py:1-2"');
		expect(first?.body.messages).toEqual([
			{ role: 'user', content: 'Why does add() return -1?' },
		]);

		// Apply goes through a diff preview; accepting edits the buffer but doesn't save.
		await reply.locator('[data-code-block]').getByRole('button', { name: 'Apply…' }).click();
		const preview = page.locator('[data-apply-preview="calc.py"]');
		await expect(preview).toBeVisible();
		await preview.getByRole('button', { name: 'Accept' }).click();
		await expect(editor.locator('.view-lines')).toContainText('return a + b', {
			timeout: 10_000,
		});
		expect(readFileSync(join(project.dir, 'calc.py'), 'utf8')).toBe(ORIGINAL);
		await page.keyboard.press('Control+z');
		await expect(editor.locator('.view-lines')).toContainText('return a - b');

		// Inline edit: Ctrl+I on the selection, streamed in place, accepted with Tab.
		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Home');
		await page.keyboard.press('Shift+ArrowDown');
		await page.keyboard.press('Shift+End');
		await page.keyboard.press('Control+i');
		const box = page.getByPlaceholder(/Edit with AI/);
		await expect(box).toBeVisible();
		await box.fill('fix the bug');
		await page.keyboard.press('Enter');
		await expect(page.getByText('Change applied')).toBeVisible({ timeout: 20_000 });
		await page.keyboard.press('Tab');
		await expect(page.getByText('Change applied')).toHaveCount(0);
		await expect(editor.locator('.view-lines')).toContainText('return a + b');
		const edit = captured.find((c) => c.body.system.includes('ONLY the code that replaces'));
		expect(edit?.body.messages.at(-1)?.content).toBe('fix the bug');

		// Ghost text: typing at the end of a line asks the autocomplete model.
		await editor.locator('.view-line').nth(4).click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await page.keyboard.type('total = ');
		await expect
			.poll(
				() =>
					captured.some(
						(c) => c.body.stream !== true && c.body.model === 'claude-haiku-4-5',
					),
				{ timeout: 20_000 },
			)
			.toBe(true);
		await expect(editor.locator('.ghost-text-decoration, .ghost-text').first()).toBeVisible({
			timeout: 15_000,
		});
	} finally {
		await app.close();
		server.close();
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		project.cleanup();
	}
});
