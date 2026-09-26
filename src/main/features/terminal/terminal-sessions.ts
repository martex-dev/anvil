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
	/** Scrollback as the pty's own chunks, so output never re-copies the whole backlog. */
	backlog: string[];
	backlogSize: number;
	/** Old output was dropped, so the backlog may start mid-line (or mid escape sequence). */
	backlogTrimmed: boolean;
	pending: string;
	timer: ReturnType<typeof setTimeout> | null;
}

export interface SessionEvents {
	onData(sessionId: string, data: string): void;
	onExit(sessionId: string, exitCode: number): void;
}

/** ~256 KB of scrollback kept in main so a reloaded renderer can reattach with history. */
export const BACKLOG_LIMIT = 256 * 1024;
const BACKLOG_CHUNK = 4096;
const FLUSH_MS = 8;

export class TerminalSessions {
	private readonly sessions = new Map<string, Session>();
	/** Starts in flight (launching awaits `which`, IPython checks…) and kills made meanwhile. */
	private readonly starting = new Map<string, Promise<void>>();
	private readonly cancelled = new Set<string>();

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

	/**
	 * Runs `launch` (which ends in start()) unless the session exists or is already starting; a
	 * concurrent caller (StrictMode mounts the pane twice) waits for that start instead of
	 * spawning a second shell. True only for the call that started it, so an initial command is
	 * typed exactly once.
	 */
	ensure(id: string, launch: () => Promise<void>): Promise<boolean> {
		return this.startOnce(id, () => !this.sessions.has(id), launch);
	}

	/** Resolves once a start in flight for `id` (if any) has finished, whether or not it worked. */
	async settled(id: string): Promise<void> {
		await this.starting.get(id)?.catch(() => undefined);
	}

	/** Starts an exited session again; no-op while it runs or is already starting. */
	relaunch(id: string, launch: () => Promise<void>): Promise<boolean> {
		return this.startOnce(id, () => this.sessions.get(id)?.pty === null, launch);
	}

	private async startOnce(
		id: string,
		needed: () => boolean,
		launch: () => Promise<void>,
	): Promise<boolean> {
		const inflight = this.starting.get(id);
		if (inflight) {
			await inflight;
			return false;
		}
		if (!needed()) return false;
		const run = launch().finally(() => this.starting.delete(id));
		this.starting.set(id, run);
		try {
			await run;
		} finally {
			// Closed (or the app quit) while it was starting: don't leave that shell running.
			if (this.cancelled.delete(id)) this.kill(id);
		}
		return true;
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
			backlog: [],
			backlogSize: 0,
			backlogTrimmed: false,
			pending: '',
			timer: null,
		};
		this.sessions.set(id, session);
		session.cols = cols;
		session.rows = rows;
		// Never orphan a live process: kill() only knows about session.pty.
		const previous = session.pty;
		session.pty = null;
		previous?.kill();
		const pty = this.spawn(spec, { cwd, cols, rows });
		session.pty = pty;
		pty.onData((data) => {
			if (session.pty === pty) this.push(session, data);
		});
		pty.onExit(({ exitCode }) => {
			if (session.pty !== pty) return;
			this.flush(session);
			session.pty = null;
			this.events.onExit(id, exitCode);
		});
	}

	/**
	 * The scrollback to replay on reattach. After trimming it starts at the first full line, so
	 * the replay never begins inside an ANSI escape sequence or a surrogate pair.
	 */
	backlog(id: string): string {
		const session = this.sessions.get(id);
		if (!session) return '';
		const text = session.backlog.join('').slice(-BACKLOG_LIMIT);
		if (!session.backlogTrimmed && text.length === session.backlogSize) return text;
		const newline = text.indexOf('\n');
		return newline === -1 ? text : text.slice(newline + 1);
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
		if (this.starting.has(id)) this.cancelled.add(id);
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
		// Coalesce keystroke-sized echoes so the chunk list stays short (cheap shift()).
		const last = session.backlog.length - 1;
		const tail = session.backlog[last];
		if (tail !== undefined && tail.length < BACKLOG_CHUNK) session.backlog[last] = tail + data;
		else session.backlog.push(data);
		session.backlogSize += data.length;
		// Drop whole chunks from the front; joining happens only on reattach.
		let first = session.backlog[0];
		while (first !== undefined && session.backlogSize - first.length >= BACKLOG_LIMIT) {
			session.backlog.shift();
			session.backlogSize -= first.length;
			session.backlogTrimmed = true;
			first = session.backlog[0];
		}
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
