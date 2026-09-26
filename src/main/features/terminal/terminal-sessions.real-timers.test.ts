import { describe, expect, it, vi } from 'vitest';

import type { LaunchSpec } from './presets';
import type { PtyLike } from './terminal-sessions';
import { TerminalSessions } from './terminal-sessions';

const spec: LaunchSpec = { file: 'pwsh.exe', args: [], env: {}, title: 'PowerShell' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TerminalSessions (real timers)', () => {
	it('emits every burst, not just the first one', async () => {
		let emit: (d: string) => void = () => undefined;
		const pty: PtyLike = {
			pid: 1,
			onData: (l) => {
				emit = l;
				return { dispose: () => undefined };
			},
			onExit: () => ({ dispose: () => undefined }),
			write: () => undefined,
			resize: () => undefined,
			kill: () => undefined,
		};
		const onData = vi.fn();
		const sessions = new TerminalSessions(() => pty, { onData, onExit: vi.fn() });
		sessions.start('s1', 'powershell', spec, 'C:/', 80, 24);
		emit('first');
		await wait(30);
		emit('second');
		await wait(30);
		emit('third');
		await wait(30);
		expect(onData.mock.calls.map((c) => c[1])).toEqual(['first', 'second', 'third']);
	});
});
