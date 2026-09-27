import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { encodeMessage, MessageDecoder } from '../../core/framing';
import { killTree } from '../../core/process-utils';
import type { RunInTerminalArgs } from './shell-command';

export type DapMessage = Record<string, unknown>;

export interface DapSessionEvents {
	/** Anything from the adapter except runInTerminal requests. */
	message(message: DapMessage): void;
	/** The adapter wants the program started in a terminal (DAP reverse request). */
	runInTerminal(seq: number, args: RunInTerminalArgs, title: string): void;
	exit(code: number | null, stderr: string): void;
}

export interface AdapterLaunch {
	python: string;
	env: NodeJS.ProcessEnv;
	cwd: string;
}

type Spawn = (
	file: string,
	args: string[],
	options: { cwd: string; env: NodeJS.ProcessEnv; windowsHide: boolean; detached: boolean },
) => ChildProcessWithoutNullStreams;

/** Messages main itself sends (replies, the goodbye on stop) use their own seq range. */
let mainSeq = 1_000_000;
const DISCONNECT_WAIT_MS = 1500;
const STDERR_TAIL = 4_000;

function isStrings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function parseRunInTerminal(args: unknown): RunInTerminalArgs | null {
	if (typeof args !== 'object' || args === null) return null;
	const a = args as Record<string, unknown>;
	if (!isStrings(a['args'])) return null;
	const env: Record<string, string | null> = {};
	if (typeof a['env'] === 'object' && a['env'] !== null) {
		for (const [k, v] of Object.entries(a['env'])) {
			if (typeof v === 'string' || v === null) env[k] = v;
		}
	}
	return {
		args: a['args'],
		env,
		...(typeof a['cwd'] === 'string' ? { cwd: a['cwd'] } : {}),
	};
}

/**
 * One `python -m debugpy.adapter` process speaking DAP over stdio. It's a relay with two
 * exceptions: launch requests get main's own configuration, and runInTerminal requests are
 * turned into a terminal command instead of reaching the renderer raw.
 */
export class DapSession {
	private readonly child: ChildProcessWithoutNullStreams;
	private readonly decoder = new MessageDecoder();
	private stderrTail = '';
	private exited = false;
	private readonly exitWaiters: Array<() => void> = [];

	constructor(
		readonly id: string,
		launch: AdapterLaunch,
		private readonly launchArgs: Record<string, unknown>,
		private readonly events: DapSessionEvents,
		spawnFn: Spawn = spawn,
	) {
		this.child = spawnFn(launch.python, ['-m', 'debugpy.adapter'], {
			cwd: launch.cwd,
			env: launch.env,
			windowsHide: true,
			// Own process group on POSIX, so killTree also ends the debuggee the adapter started.
			detached: process.platform !== 'win32',
		});
		this.child.stdout.on('data', (chunk: Buffer) => {
			try {
				for (const message of this.decoder.push(chunk)) this.fromAdapter(message);
			} catch (error) {
				// Garbage on stdout: the stream can't be trusted any more.
				this.appendStderr(`\n[anvil] ${String(error)}`);
				void this.dispose();
			}
		});
		// A stream decoder keeps a multi-byte character split across two chunks intact.
		this.child.stderr.setEncoding('utf8');
		this.child.stderr.on('data', (chunk: string) => this.appendStderr(chunk));
		// Writing after the adapter died raises EPIPE on the stream; without a listener that is an
		// uncaught exception in main. The exit event reports what happened.
		this.child.stdin.on('error', (error) => {
			this.appendStderr(`\n[anvil] stdin: ${error.message}`);
		});
		this.child.on('error', (error) => {
			this.appendStderr(`\n${error.message}`);
			// A spawn failure never emits 'exit'.
			if (this.child.pid === undefined) this.finish(null);
		});
		this.child.on('exit', (code) => this.finish(code));
	}

	get pid(): number | undefined {
		return this.child.pid;
	}

	private appendStderr(text: string): void {
		this.stderrTail = (this.stderrTail + text).slice(-STDERR_TAIL);
	}

	private finish(code: number | null): void {
		if (this.exited) return;
		this.exited = true;
		for (const resolve of this.exitWaiters.splice(0)) resolve();
		this.events.exit(code, this.stderrTail.trim());
	}

	private fromAdapter(message: unknown): void {
		if (typeof message !== 'object' || message === null) return;
		const m = message as DapMessage;
		if (m['type'] === 'request' && m['command'] === 'runInTerminal') {
			const args = parseRunInTerminal(m['arguments']);
			const seq = typeof m['seq'] === 'number' ? m['seq'] : 0;
			const title = (m['arguments'] as Record<string, unknown> | undefined)?.['title'];
			if (args) this.events.runInTerminal(seq, args, typeof title === 'string' ? title : '');
			else this.reply(seq, 'runInTerminal', 'Malformed runInTerminal request');
			return;
		}
		// After answering a disconnect, debugpy's adapter only exits once its stdin closes.
		if (m['type'] === 'response' && m['command'] === 'disconnect') this.child.stdin.end();
		this.events.message(m);
	}

	/** Answers a reverse request from main itself (success when `error` is omitted). */
	reply(requestSeq: number, command: string, error?: string): void {
		this.write({
			seq: mainSeq++,
			type: 'response',
			request_seq: requestSeq,
			command,
			success: error === undefined,
			...(error === undefined ? { body: {} } : { message: error }),
		});
	}

	/** A message from the renderer's debug client. */
	send(message: DapMessage): void {
		if (message['type'] === 'request' && message['command'] === 'attach')
			throw new Error('Attaching is not supported');
		// Keep the renderer's own fields (restart markers) but never its interpreter or program.
		const out =
			message['type'] === 'request' && message['command'] === 'launch'
				? { ...message, arguments: this.launchArgs }
				: message;
		this.write(out);
	}

	private write(message: DapMessage): void {
		if (this.exited || !this.child.stdin.writable) return;
		this.child.stdin.write(encodeMessage(message));
	}

	/**
	 * Asks the adapter to end the program (it runs in a terminal, not as our child) and exit, then
	 * kills whatever is left.
	 */
	async dispose(): Promise<void> {
		if (this.exited) return;
		const gone = new Promise<void>((resolve) => this.exitWaiters.push(resolve));
		this.write({
			seq: mainSeq++,
			type: 'request',
			command: 'disconnect',
			arguments: { terminateDebuggee: true },
		});
		const timeout = new Promise<'timeout'>((resolve) =>
			setTimeout(() => resolve('timeout'), DISCONNECT_WAIT_MS).unref(),
		);
		if ((await Promise.race([gone, timeout])) !== 'timeout') return;
		if (this.child.pid) await killTree(this.child.pid);
		else this.child.kill();
	}
}
