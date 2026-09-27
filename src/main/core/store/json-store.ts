import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { z } from 'zod';

import { moveAside, readJsonFile } from './json-file';

/** Typed key/value settings. WorkspaceService and features depend on this, not on the file. */
export interface SettingsStore {
	get<S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S>;
	set<S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S>;
	delete(key: string): void;
}

type Data = Record<string, unknown>;

const isObject = (value: unknown): value is Data =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Settings in one JSON file under userData. An editor's settings are tiny, so the whole map
 * lives in memory and is written back (atomically: temp file + rename) shortly after a change.
 * Reads are validated; a corrupt or outdated value falls back instead of crashing the app.
 */
export class JsonStore implements SettingsStore {
	private data: Data;
	private timer: NodeJS.Timeout | null = null;
	/** Grows after each failed background write so a stuck file isn't retried in a tight loop. */
	private retryMs = 0;
	/**
	 * Set while the file exists but could not be read (locked). Until a read succeeds, writes
	 * must merge into it rather than replace it: the user's settings are still in there.
	 */
	private unread = false;
	/** Keys set or deleted while `unread`, so the merge knows which values are newer. */
	private readonly touched = new Set<string>();

	constructor(
		private readonly filePath: string,
		private readonly onInvalid: (key: string, issues: string) => void = () => undefined,
		private readonly delayMs = 250,
		private readonly onWriteError: (error: unknown) => void = () => undefined,
		private readonly onReadError: (error: unknown) => void = () => undefined,
	) {
		this.data = this.load();
	}

	get<S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S> {
		if (!(key in this.data)) return fallback;
		const parsed = schema.safeParse(this.data[key]);
		if (!parsed.success) {
			this.onInvalid(key, parsed.error.message);
			return fallback;
		}
		return parsed.data;
	}

	set<S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S> {
		const parsed = schema.parse(value);
		// "No value" is stored as a missing key, so reads fall back to their default.
		if (parsed === null || parsed === undefined) this.delete(key);
		else {
			this.data[key] = parsed;
			if (this.unread) this.touched.add(key);
			this.schedule();
		}
		return parsed;
	}

	delete(key: string): void {
		// While the file is unread the key may still be on disk, so the delete must be written.
		if (this.unread) this.touched.add(key);
		else if (!(key in this.data)) return;
		const { [key]: _removed, ...rest } = this.data;
		this.data = rest;
		this.schedule();
	}

	/** Writes pending changes now (quit, tests). Throws if the file can't be written. */
	flush(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		if (this.unread) this.mergeUnread();
		mkdirSync(dirname(this.filePath), { recursive: true });
		const tmp = `${this.filePath}.tmp`;
		writeFileSync(tmp, JSON.stringify(this.data, null, '\t'), 'utf8');
		renameSync(tmp, this.filePath);
	}

	private schedule(): void {
		if (this.timer) return;
		this.timer = setTimeout(() => this.flushInBackground(), this.retryMs || this.delayMs);
		this.timer.unref?.();
	}

	/**
	 * A timer callback that throws would crash main. On Windows the rename often fails briefly
	 * (antivirus, indexer holding the file), so report it and retry with backoff instead.
	 */
	private flushInBackground(): void {
		try {
			this.flush();
			this.retryMs = 0;
		} catch (error) {
			this.timer = null;
			this.retryMs = Math.min(Math.max(this.retryMs * 2, 1_000), 60_000);
			this.onWriteError(error);
			this.schedule();
		}
	}

	/** Reads the file that was locked at startup and lays this session's changes over it. */
	private mergeUnread(): void {
		const disk = this.readDisk();
		const newer = Object.fromEntries(
			Object.entries(this.data).filter(([key]) => this.touched.has(key)),
		);
		const kept = Object.entries(disk).filter(([key]) => !this.touched.has(key));
		this.data = { ...Object.fromEntries(kept), ...newer };
		this.unread = false;
		this.touched.clear();
	}

	private load(): Data {
		try {
			return this.readDisk();
		} catch (error) {
			// Locked or failing disk: the file may be fine. Start with defaults for now, but never
			// overwrite it with them (see `unread`).
			this.unread = true;
			this.onReadError(error);
			return {};
		}
	}

	/** The file's settings; moves an unusable file aside. Throws when it can't be read. */
	private readDisk(): Data {
		const file = readJsonFile(this.filePath);
		if (file.kind === 'missing') return {};
		if (file.kind === 'ok' && isObject(file.value)) return file.value;
		this.onInvalid(
			'<file>',
			file.kind === 'corrupt' ? file.reason : 'settings file is not a JSON object',
		);
		// Keep a copy for inspection and start fresh rather than refusing to boot.
		try {
			moveAside(this.filePath);
		} catch (error) {
			// The next write replaces the file anyway; only the inspection copy is lost.
			this.onReadError(error);
		}
		return {};
	}
}
