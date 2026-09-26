import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { killTree } from '../../core/process-utils';
import { encodeMessage, MessageDecoder } from './framing';
import type { ServerLaunch } from './servers';

export interface SessionEvents {
	message(message: unknown): void;
	exit(code: number | null, stderr: string): void;
}

/** One language-server process speaking LSP over stdio. */
export class LspSession {
	private readonly child: ChildProcessWithoutNullStreams;
	private readonly decoder = new MessageDecoder();
	private stderrTail = '';
	private exited = false;

	constructor(
		readonly id: string,
		launch: ServerLaunch,
		cwd: string,
		events: SessionEvents,
		node: string = process.execPath,
	) {
		this.child = spawn(node, [launch.script, ...launch.args], {
			cwd,
			env: launch.env,
			windowsHide: true,
			// Own process group on POSIX, so killTree can take down the server's workers too.
			detached: process.platform !== 'win32',
		});
		this.child.stdout.on('data', (chunk: Buffer) => {
			try {
				for (const message of this.decoder.push(chunk)) events.message(message);
			} catch (error) {
				// Garbage on stdout (a print() in a server plugin): the stream can't be trusted now.
				this.appendStderr(`\n[anvil] ${String(error)}`);
				void this.dispose();
			}
		});
		this.child.stderr.on('data', (chunk: Buffer) => {
			this.appendStderr(chunk.toString('utf8'));
		});
		// A crashing server closes its pipe before 'exit' arrives; writing then fails with EPIPE,
		// which without a listener is an uncaught exception that takes down the main process.
		this.child.stdin.on('error', (error) => {
			this.appendStderr(`\n[anvil] stdin: ${error.message}`);
		});
		this.child.on('error', (error) => {
			this.appendStderr(`\n${error.message}`);
		});
		this.child.on('exit', (code) => {
			this.exited = true;
			events.exit(code, this.stderrTail.trim());
		});
	}

	get pid(): number | undefined {
		return this.child.pid;
	}

	send(message: unknown): void {
		if (this.exited || !this.child.stdin.writable) return;
		try {
			this.child.stdin.write(encodeMessage(message));
		} catch (error) {
			// The stream was destroyed between the check and the write; 'exit' reports the crash.
			this.appendStderr(`\n[anvil] stdin: ${String(error)}`);
		}
	}

	private appendStderr(text: string): void {
		this.stderrTail = (this.stderrTail + text).slice(-4_000);
	}

	async dispose(): Promise<void> {
		if (this.exited) return;
		// tsserver runs as a grandchild; kill the whole tree so nothing is left behind.
		if (this.child.pid) await killTree(this.child.pid);
		else this.child.kill();
	}
}
