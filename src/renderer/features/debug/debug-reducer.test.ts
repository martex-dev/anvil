import { describe, expect, it } from 'vitest';

import {
	type DebugAction,
	debugReducer,
	type DebugState,
	INITIAL_DEBUG_STATE,
	isDebugging,
	MAX_CONSOLE_LINES,
	selectedFrame,
} from './debug-reducer';

const run = (actions: DebugAction[], from: DebugState = INITIAL_DEBUG_STATE): DebugState =>
	actions.reduce(debugReducer, from);

const frames = [
	{ id: 2, name: '<module>', line: 4, column: 1, source: { path: 'C:\\p\\main.py' } },
	{ id: 3, name: 'runner', line: 10, column: 1 },
];

const live: DebugAction[] = [
	{ type: 'starting', label: 'main.py' },
	{ type: 'started', session: 's1' },
];
const stop = (threadId = 1, reason = 'breakpoint'): DebugAction => ({
	type: 'event',
	event: 'stopped',
	body: { threadId, reason },
});

describe('debug session reducer', () => {
	it('goes from starting to running to paused, and bumps the generation on each stop', () => {
		const s = run([...live, stop()]);
		expect(s.status).toBe('paused');
		expect(s.session).toBe('s1');
		expect(s.threadId).toBe(1);
		expect(s.stopReason).toBe('breakpoint');
		expect(s.generation).toBe(1);
		expect(isDebugging(s)).toBe(true);
		expect(isDebugging(INITIAL_DEBUG_STATE)).toBe(false);
		expect(run([stop()], s).generation).toBe(2);
	});

	it('selects the top frame when the stack arrives, and only frames that exist', () => {
		let s = run([...live, stop(), { type: 'frames', threadId: 1, frames }]);
		expect(s.frameId).toBe(2);
		expect(selectedFrame(s)?.name).toBe('<module>');
		s = run([{ type: 'selectFrame', frameId: 3 }], s);
		expect(selectedFrame(s)?.name).toBe('runner');
		expect(run([{ type: 'selectFrame', frameId: 99 }], s).frameId).toBe(3);
	});

	it('ignores a stack for another thread or after the program ran on', () => {
		const paused = run([...live, stop(1)]);
		expect(run([{ type: 'frames', threadId: 7, frames }], paused).frames).toEqual([]);
		const resumed = run([{ type: 'event', event: 'continued', body: {} }], paused);
		expect(resumed.status).toBe('running');
		expect(run([{ type: 'frames', threadId: 1, frames }], resumed).frames).toEqual([]);
	});

	it('clears frames and the stop reason when the program continues', () => {
		const s = run([
			...live,
			stop(),
			{ type: 'frames', threadId: 1, frames },
			{ type: 'event', event: 'continued', body: {} },
		]);
		expect(s).toMatchObject({ status: 'running', frames: [], frameId: null, stopReason: null });
	});

	it('writes output to the console, skipping telemetry, and caps its length', () => {
		let s = run([
			...live,
			{ type: 'event', event: 'output', body: { category: 'telemetry', output: 'ptvsd' } },
			{
				type: 'event',
				event: 'output',
				body: { category: 'stdout', output: 'log x=42\r\n' },
			},
			{ type: 'event', event: 'output', body: { category: 'stderr', output: 'boom\n' } },
			{ type: 'event', event: 'exited', body: { exitCode: 0 } },
		]);
		expect(s.console.map((l) => [l.kind, l.text])).toEqual([
			['output', 'log x=42'],
			['error', 'boom'],
			['info', 'Program exited with code 0'],
		]);
		for (let i = 0; i < MAX_CONSOLE_LINES + 5; i++)
			s = debugReducer(s, { type: 'console', kind: 'output', text: String(i) });
		expect(s.console).toHaveLength(MAX_CONSOLE_LINES);
		expect(s.console.at(-1)?.text).toBe(String(MAX_CONSOLE_LINES + 4));
	});

	it('waits in stopping after terminated, then ends with or without an error', () => {
		const s = run([...live, stop(), { type: 'event', event: 'terminated', body: {} }]);
		expect(s.status).toBe('stopping');
		expect(s.frames).toEqual([]);
		// A late stop from the dying program must not re-pause the views.
		expect(run([stop()], s).status).toBe('stopping');
		const ended = run([{ type: 'ended', error: 'adapter crashed' }], s);
		expect(ended).toMatchObject({ status: 'idle', session: null, error: 'adapter crashed' });
		expect(run([{ type: 'starting', label: 'x' }], ended).error).toBeNull();
	});

	it('remembers what to install when debugpy is missing, until the next start', () => {
		const install = { env: '.venv', command: 'uv pip install debugpy' };
		const s = run([
			{ type: 'starting', label: 'main.py' },
			{ type: 'ended', install },
		]);
		expect(s.install).toEqual(install);
		expect(run([{ type: 'starting', label: 'main.py' }], s).install).toBeNull();
	});

	it('keeps an exception description only while paused', () => {
		const paused = run([...live, stop(1, 'exception')]);
		expect(
			run([{ type: 'stopDetail', text: 'ZeroDivisionError: division by zero' }], paused)
				.stopDetail,
		).toBe('ZeroDivisionError: division by zero');
		const running = run([{ type: 'event', event: 'continued', body: {} }], paused);
		expect(run([{ type: 'stopDetail', text: 'x' }], running).stopDetail).toBeNull();
	});
});
