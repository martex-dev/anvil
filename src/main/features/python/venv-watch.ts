import { type FSWatcher, watch } from 'node:fs';

/** Top-level names that can hold the folder's own env (see candidates() in envs.ts). */
const LOCAL_ENV_NAMES = new Set(['.venv', 'venv', 'env', '.env']);

export interface LocalEnvWatcherOptions {
	/** Re-resolves the folder's interpreter; the watcher compares successive results. */
	resolve: (root: string) => string | null;
	/** Called once the resolved interpreter differs from the last one seen. */
	onChange: () => void;
	onError: (error: unknown) => void;
	/** Injectable so tests don't depend on OS file events. */
	watchDir?: (root: string, listener: (name: string | null) => void) => FSWatcher;
	pollMs?: number;
	maxPolls?: number;
}

const watchTopLevel = (root: string, listener: (name: string | null) => void): FSWatcher =>
	watch(root, { persistent: false }, (_event, name) => listener(name ? String(name) : null));

/**
 * Notices a venv being created or deleted in the open folder (`uv venv`, `python -m venv`,
 * removing .venv). The workspace watcher ignores env folders, and the interpreter binary lands a
 * few seconds after the folder appears, so an event here starts a short poll that stops as soon
 * as the resolved interpreter changes.
 */
export class LocalEnvWatcher {
	private watcher: FSWatcher | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private root: string | null = null;
	private last: string | null = null;
	private remaining = 0;
	private readonly pollMs: number;
	private readonly maxPolls: number;

	constructor(private readonly opts: LocalEnvWatcherOptions) {
		this.pollMs = opts.pollMs ?? 500;
		this.maxPolls = opts.maxPolls ?? 240;
	}

	start(root: string | null): void {
		this.stop();
		this.root = root;
		if (!root) return;
		this.last = this.opts.resolve(root);
		try {
			this.watcher = (this.opts.watchDir ?? watchTopLevel)(root, (name) => {
				if (name === null || LOCAL_ENV_NAMES.has(name.toLowerCase())) this.poke();
			});
			this.watcher.on('error', (error) => this.opts.onError(error));
		} catch (error) {
			this.opts.onError(error);
		}
	}

	/** Polls for an interpreter change for up to pollMs × maxPolls. */
	poke(): void {
		if (!this.root) return;
		this.remaining = this.maxPolls;
		this.timer ??= setInterval(() => this.tick(), this.pollMs);
	}

	/** Takes the current interpreter as the baseline (after a pick or any other change). */
	sync(): void {
		if (this.root) this.last = this.opts.resolve(this.root);
	}

	stop(): void {
		this.stopPolling();
		this.watcher?.close();
		this.watcher = null;
		this.root = null;
	}

	private tick(): void {
		const root = this.root;
		if (!root) return this.stopPolling();
		const now = this.opts.resolve(root);
		if (now !== this.last) {
			this.last = now;
			this.stopPolling();
			this.opts.onChange();
			return;
		}
		if (--this.remaining <= 0) this.stopPolling();
	}

	private stopPolling(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}
