/* eslint-disable no-console -- dev script: progress goes to the terminal */
/**
 * Captures the README screenshots against a local mock of the Anthropic API (no key, no cost).
 * Usage: npx tsx scripts/readme-shots.mts <demo-folder> <out-dir>
 */
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron } from '@playwright/test';

const demo = process.argv[2];
const outDir = process.argv[3] ?? 'docs/screenshots';
if (!demo) throw new Error('usage: readme-shots.mts <demo-folder> <out-dir>');
mkdirSync(outDir, { recursive: true });

const CHAT = [
	'Two things will make this backtest lie to you:\n\n',
	'1. **`diff(lookback - 5).shift(5)`** is fine for the signal, but `VolTarget.weights` uses ',
	'`rolling_std` on the *same* bar it trades — you already `shift(1)`, good.\n',
	'2. `sharpe()` annualises daily returns with **252**, but crypto trades **365** days a year.\n\n',
	'```python\nTRADING_DAYS = 365  # crypto: every day is a trading day\n```\n',
	'With 365 the Sharpe on your sample drops from **1.42** to **1.18**.',
];
const EDIT = [
	'```python\ndef sharpe(returns: np.ndarray, periods: int = TRADING_DAYS) -> float:\n',
	'\t"""Annualised Sharpe ratio of simple returns (risk-free rate = 0)."""\n',
	'\treturns = returns[~np.isnan(returns)]\n',
	'\tif returns.size < 2:\n\t\treturn float("nan")\n',
	'\tmu = returns.mean() * periods\n',
	'\tsigma = returns.std(ddof=1) * np.sqrt(periods)\n',
	'\treturn float(mu / sigma) if sigma > 0 else float("nan")\n```',
];

const server = createServer((req, res) => {
	let raw = '';
	req.on('data', (c: Buffer) => (raw += c.toString('utf8')));
	req.on('end', () => {
		const body = JSON.parse(raw) as { stream?: boolean; system: string };
		if (!body.stream) {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(
				JSON.stringify({
					content: [
						{
							type: 'text',
							text: '<completion>np.maximum.accumulate(equity)\n\tdrawdown = equity / peak - 1',
						},
					],
				}),
			);
			return;
		}
		const chunks = body.system.includes('ONLY the code that replaces') ? EDIT : CHAT;
		res.writeHead(200, { 'content-type': 'text/event-stream' });
		const events: Array<[string, unknown]> = [
			[
				'message_start',
				{ type: 'message_start', message: { usage: { input_tokens: 1843 } } },
			],
			...chunks.map((text): [string, unknown] => [
				'content_block_delta',
				{ type: 'content_block_delta', delta: { type: 'text_delta', text } },
			]),
			['message_delta', { type: 'message_delta', usage: { output_tokens: 212 } }],
			['message_stop', { type: 'message_stop' }],
		];
		let i = 0;
		const next = (): void => {
			const e = events[i++];
			if (!e) return void res.end();
			res.write(`event: ${e[0]}\ndata: ${JSON.stringify(e[1])}\n\n`);
			setTimeout(next, 25);
		};
		next();
	});
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;

const userDataDir = mkdtempSync(join(tmpdir(), 'anvil-readme-'));
const app = await electron.launch({
	args: ['.', `--user-data-dir=${userDataDir}`],
	env: { ...process.env, ANVIL_E2E: '1', ANVIL_AI_API: `http://127.0.0.1:${port}` },
});
const page = await app.firstWindow();
await page.setViewportSize({ width: 1720, height: 1000 });
const shot = async (name: string, wait = 900): Promise<void> => {
	await page.waitForTimeout(wait);
	await page.screenshot({ path: join(outDir, `${name}.png`) });
	console.log('shot', name);
};
const tree = (name: RegExp) => page.getByRole('treeitem', { name }).first();

await page.waitForTimeout(1200);
await page.evaluate(() =>
	window.anvil.invoke('secrets:set', { key: 'anthropic.key', value: 'sk-ant-demo' }),
);
await page.evaluate((p) => window.anvil.invoke('workspace:open', p), demo);
await shot('welcome', 2000);

await tree(/src/).click();
await tree(/lab/).click();
await tree(/strategy\.py/).dblclick();
await page.waitForTimeout(5000);

// REPL: run the first cell.
const host = page.locator('[data-editor-host]').first();
await host.click({ position: { x: 360, y: 110 } });
await page.keyboard.press('Shift+Enter');
await page.waitForTimeout(7000);
await page.keyboard.press('Shift+Enter');
await page.waitForTimeout(3000);

// Chat about the file.
const chat = page.locator('[data-ai-chat]');
await chat.getByRole('button', { name: 'File' }).click();
await chat
	.getByRole('textbox', { name: 'Message' })
	.fill('Is this backtest honest? Anything that inflates the Sharpe?');
await page.keyboard.press('Enter');
await chat
	.locator('[data-chat-role="assistant"][data-streaming="false"]')
	.waitFor({ timeout: 20_000 });
await shot('hero', 1200);

// Inline edit on sharpe().
await page.keyboard.press('Control+g');
await page.keyboard.type('31');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.keyboard.press('Home');
for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowDown');
await page.keyboard.press('Shift+End');
await page.keyboard.press('Control+i');
await page.getByPlaceholder(/Edit with AI/).fill('Handle NaNs and short series, add a docstring');
await page.keyboard.press('Enter');
await page.getByText('Change applied').waitFor({ timeout: 20_000 });
await shot('inline-edit', 800);
await page.keyboard.press('Tab');

// Data grid with a column profile.
await tree(/data/).click();
await tree(/prices\.csv/).dblclick();
await page.waitForTimeout(2500);
await page.getByRole('grid').getByText('BTC').first().click();
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
await shot('data', 2000);

// Palette over everything.
await page.keyboard.press('Control+Shift+P');
await page.keyboard.type('python');
await shot('palette', 800);
await page.keyboard.press('Escape');

// Accent + toolbox.
await page.evaluate(() => window.anvil.invoke('settings:update', { accent: 'magenta' }));
await page.keyboard.press('Control+Shift+X');
await page.getByPlaceholder(/1790000000/).fill('1727308800000');
await shot('toolbox-magenta', 1500);
await page.evaluate(() => window.anvil.invoke('settings:update', { accent: 'cyan' }));

await app.close();
server.close();
