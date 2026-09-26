import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LaunchSpec } from './presets';
import { BACKLOG_LIMIT, type PtyLike, TerminalSessions } from './terminal-sessions';

class FakePty implements PtyLike {
	pid = 1234;
	written: string[] = [];
	killed = false;
	private data: Array<(d: string) => void> = [];
	private exit: Array<(e: { exitCode: number }) => void> = [];
	onData(l: (d: string) => void) {
		this.data.push(l);
		return { dispose: () => undefined };
	}
	onExit(l: (e: { exitCode: number }) => void) {
		this.exit.push(l);
		return { dispose: () => undefined };
	}
	write(d: string) {
		this.written.push(d);
	}
	resize() {}
	kill() {
		this.killed = true;
	}
	emit(d: string) {
		for (const l of this.data) l(d);
	}
	exitWith(code: number) {
		for (const l of this.exit) l({ exitCode: code });
	}
}

const spec: LaunchSpec = { file: 'pwsh.exe', args: [], env: {}, title: 'PowerShell' };

let ptys: FakePty[];
let onData: ReturnType<typeof vi.fn<(id: string, d: string) => void>>;
let onExit: ReturnType<typeof vi.fn<(id: string, code: number) => void>>;
let sessions: TerminalSessions;

beforeEach(() => {
	vi.useFakeTimers();
	ptys = [];
	onData = vi.fn();
	onExit = vi.fn();
	sessions = new TerminalSessions(
		() => {
			const p = new FakePty();
			ptys.push(p);
			return p;
		},
		{ onData, onExit },
	);
});
afterEach(() => vi.useRealTimers());

describe('TerminalSessions', () => {
	it('batches output bursts into one message', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		ptys[0]?.emit('a');
		ptys[0]?.emit('b');
		ptys[0]?.emit('c');
		expect(onData).not.toHaveBeenCalled();
		vi.advanceTimersByTime(10);
		expect(onData).toHaveBeenCalledTimes(1);
		expect(onData).toHaveBeenCalledWith('s1', 'abc');
	});

	it('keeps a bounded backlog for reattaching', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		ptys[0]?.emit('x'.repeat(BACKLOG_LIMIT));
		ptys[0]?.emit('tail');
		expect(sessions.get('s1')?.backlog.length).toBe(BACKLOG_LIMIT);
		expect(sessions.get('s1')?.backlog.endsWith('tail')).toBe(true);
	});

	it('forwards input and reports exit after flushing pending output', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		sessions.write('s1', 'dir\r');
		expect(ptys[0]?.written).toEqual(['dir\r']);
		ptys[0]?.emit('bye');
		ptys[0]?.exitWith(0);
		expect(onData).toHaveBeenCalledWith('s1', 'bye');
		expect(onExit).toHaveBeenCalledWith('s1', 0);
		expect(sessions.get('s1')?.pty).toBeNull();
	});

	it('reports writes to an exited session as not delivered and remembers its size', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		expect(sessions.write('s1', 'a')).toBe(true);
		sessions.resize('s1', 120, 40);
		ptys[0]?.exitWith(0);
		expect(sessions.write('s1', 'python a.py\r')).toBe(false);
		expect(sessions.write('nope', 'x')).toBe(false);
		expect(sessions.get('s1')).toMatchObject({ cols: 120, rows: 40 });
	});

	it('restarting reuses the session (and its backlog)', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		ptys[0]?.emit('first');
		ptys[0]?.exitWith(1);
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		expect(ptys).toHaveLength(2);
		expect(sessions.get('s1')?.backlog).toContain('first');
	});

	it('starts a session once when two opens race', async () => {
		let release = (): void => undefined;
		const gate = new Promise<void>((r) => (release = r));
		const launch = vi.fn(async () => {
			await gate;
			sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		});
		const first = sessions.ensure('s1', launch);
		const second = sessions.ensure('s1', launch);
		release();
		expect(await first).toBe(true);
		expect(await second).toBe(false);
		expect(launch).toHaveBeenCalledTimes(1);
		expect(ptys).toHaveLength(1);
		expect(await sessions.ensure('s1', launch)).toBe(false);
	});

	it('kills a session closed while it was still starting', async () => {
		let release = (): void => undefined;
		const gate = new Promise<void>((r) => (release = r));
		const started = sessions.ensure('s1', async () => {
			await gate;
			sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		});
		sessions.kill('s1');
		release();
		await started;
		expect(ptys[0]?.killed).toBe(true);
		expect(sessions.has('s1')).toBe(false);
	});

	it('relaunches only an exited session', async () => {
		const launch = vi.fn(async () => {
			sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		});
		await sessions.ensure('s1', launch);
		expect(await sessions.relaunch('s1', launch)).toBe(false);
		ptys[0]?.exitWith(0);
		expect(await sessions.relaunch('s1', launch)).toBe(true);
		expect(ptys).toHaveLength(2);
	});

	it('kills a still-running process instead of orphaning it on a second start', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		expect(ptys[0]?.killed).toBe(true);
		// Late output from the replaced process is ignored.
		ptys[0]?.emit('stale');
		ptys[1]?.emit('fresh');
		vi.advanceTimersByTime(10);
		expect(onData).toHaveBeenCalledWith('s1', 'fresh');
		expect(onData).not.toHaveBeenCalledWith('s1', expect.stringContaining('stale'));
	});

	it('kill ends the process and forgets the session', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		sessions.kill('s1');
		expect(ptys[0]?.killed).toBe(true);
		expect(sessions.has('s1')).toBe(false);
		// A late exit from the killed process must not be reported.
		ptys[0]?.exitWith(0);
		expect(onExit).not.toHaveBeenCalled();
	});
});
