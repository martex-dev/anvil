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
		});
		this.child.stdout.on('data', (chunk: Buffer) => {
			try {
				for (const message of this.decoder.push(chunk)) events.message(message);
			} catch (error) {
				// Garbage on stdout (a print() in a server plugin): the stream can't be trusted now.
				this.stderrTail += `\n[anvil] ${String(error)}`;
				void this.dispose();
			}
		});
		this.child.stderr.on('data', (chunk: Buffer) => {
			this.stderrTail = (this.stderrTail + chunk.toString('utf8')).slice(-4_000);
		});
		this.child.on('error', (error) => {
			this.stderrTail += `\n${error.message}`;
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
		this.child.stdin.write(encodeMessage(message));
	}

	async dispose(): Promise<void> {
		if (this.exited) return;
		// tsserver runs as a grandchild; kill the whole tree so nothing is left behind.
		if (this.child.pid) await killTree(this.child.pid);
		else this.child.kill();
	}
}
