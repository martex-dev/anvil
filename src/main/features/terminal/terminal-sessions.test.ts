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

	it('restarting reuses the session (and its backlog)', () => {
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		ptys[0]?.emit('first');
		ptys[0]?.exitWith(1);
		sessions.start('s1', 'powershell', spec, 'C:/p', 80, 24);
		expect(ptys).toHaveLength(2);
		expect(sessions.get('s1')?.backlog).toContain('first');
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
