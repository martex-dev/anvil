import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { z } from 'zod';

/** Typed key/value settings. WorkspaceService and features depend on this, not on the file. */
export interface SettingsStore {
	get<S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S>;
	set<S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S>;
	delete(key: string): void;
}

/**
 * Settings in one JSON file under userData. An editor's settings are tiny, so the whole map
 * lives in memory and is written back (atomically: temp file + rename) shortly after a change.
 * Reads are validated; a corrupt or outdated value falls back instead of crashing the app.
 */
export class JsonStore implements SettingsStore {
	private data: Record<string, unknown>;
	private timer: NodeJS.Timeout | null = null;

	constructor(
		private readonly filePath: string,
		private readonly onInvalid: (key: string, issues: string) => void = () => undefined,
		private readonly delayMs = 250,
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
			this.schedule();
		}
		return parsed;
	}

	delete(key: string): void {
		if (!(key in this.data)) return;
		const { [key]: _removed, ...rest } = this.data;
		this.data = rest;
		this.schedule();
	}

	/** Writes pending changes now (quit, tests). */
	flush(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		mkdirSync(dirname(this.filePath), { recursive: true });
		const tmp = `${this.filePath}.tmp`;
		writeFileSync(tmp, JSON.stringify(this.data, null, '\t'), 'utf8');
		renameSync(tmp, this.filePath);
	}

	private schedule(): void {
		if (this.timer) return;
		this.timer = setTimeout(() => this.flush(), this.delayMs);
		this.timer.unref?.();
	}

	private load(): Record<string, unknown> {
		if (!existsSync(this.filePath)) return {};
		try {
			const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'));
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
		} catch (error) {
			this.onInvalid('<file>', error instanceof Error ? error.message : String(error));
		}
		// Unreadable file: keep a copy for inspection and start fresh rather than refusing to boot.
		try {
			renameSync(this.filePath, `${this.filePath}.corrupt`);
		} catch {
			// Best effort only; the next flush overwrites the file anyway.
		}
		return {};
	}
}
