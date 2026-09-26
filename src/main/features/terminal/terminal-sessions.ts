import type { TerminalPresetId } from '@shared/ipc/channels/terminal';

import type { LaunchSpec } from './presets';

/** The slice of node-pty's IPty we use; injectable so tests don't spawn real shells. */
export interface PtyLike {
	pid: number;
	onData(listener: (data: string) => void): { dispose(): void };
	onExit(listener: (e: { exitCode: number }) => void): { dispose(): void };
	write(data: string): void;
	resize(cols: number, rows: number): void;
	kill(): void;
}

export type SpawnPty = (
	spec: LaunchSpec,
	opts: { cwd: string; cols: number; rows: number },
) => PtyLike;

interface Session {
	id: string;
	preset: TerminalPresetId;
	title: string;
	cwd: string;
	/** Last known size, so an exited session can be restarted without the renderer. */
	cols: number;
	rows: number;
	pty: PtyLike | null;
	backlog: string;
	pending: string;
	timer: ReturnType<typeof setTimeout> | null;
}

export interface SessionEvents {
	onData(sessionId: string, data: string): void;
	onExit(sessionId: string, exitCode: number): void;
}

/** ~256 KB of scrollback kept in main so a reloaded renderer can reattach with history. */
export const BACKLOG_LIMIT = 256 * 1024;
const FLUSH_MS = 8;

export class TerminalSessions {
	private readonly sessions = new Map<string, Session>();

	constructor(
		private readonly spawn: SpawnPty,
		private readonly events: SessionEvents,
	) {}

	has(id: string): boolean {
		return this.sessions.has(id);
	}

	get(id: string): Readonly<Session> | undefined {
		return this.sessions.get(id);
	}

	start(
		id: string,
		preset: TerminalPresetId,
		spec: LaunchSpec,
		cwd: string,
		cols: number,
		rows: number,
	): void {
		const existing = this.sessions.get(id);
		const session: Session = existing ?? {
			id,
			preset,
			title: spec.title,
			cwd,
			cols,
			rows,
			pty: null,
			backlog: '',
			pending: '',
			timer: null,
		};
		this.sessions.set(id, session);
		session.cols = cols;
		session.rows = rows;
		const pty = this.spawn(spec, { cwd, cols, rows });
		session.pty = pty;
		pty.onData((data) => this.push(session, data));
		pty.onExit(({ exitCode }) => {
			if (session.pty !== pty) return;
			this.flush(session);
			session.pty = null;
			this.events.onExit(id, exitCode);
		});
	}

	/** False when the session doesn't exist or its process has exited (nothing was written). */
	write(id: string, data: string): boolean {
		const pty = this.sessions.get(id)?.pty;
		if (!pty) return false;
		pty.write(data);
		return true;
	}

	resize(id: string, cols: number, rows: number): void {
		const session = this.sessions.get(id);
		if (!session) return;
		session.cols = cols;
		session.rows = rows;
		try {
			session.pty?.resize(cols, rows);
		} catch {
			// Resizing a pty that is exiting throws on Windows (conpty); harmless.
		}
	}

	kill(id: string): void {
		const session = this.sessions.get(id);
		if (!session) return;
		this.sessions.delete(id);
		if (session.timer) clearTimeout(session.timer);
		const pty = session.pty;
		session.pty = null;
		pty?.kill();
	}

	killAll(): void {
		for (const id of [...this.sessions.keys()]) this.kill(id);
	}

	private push(session: Session, data: string): void {
		session.backlog = (session.backlog + data).slice(-BACKLOG_LIMIT);
		session.pending += data;
		// Batch bursts (npm install, build logs) into ~120 messages/s instead of thousands.
		session.timer ??= setTimeout(() => this.flush(session), FLUSH_MS);
	}

	private flush(session: Session): void {
		if (session.timer) clearTimeout(session.timer);
		session.timer = null;
		if (!session.pending) return;
		const data = session.pending;
		session.pending = '';
		this.events.onData(session.id, data);
	}
}
