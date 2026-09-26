import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { Snapshot } from '@shared/ipc/channels/tools';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';

const MAX_PER_FILE = 50;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const NAME = /^(\d{13})-([a-f0-9]{8})\.txt$/;

const sha = (s: string): string => createHash('sha1').update(s).digest('hex');

/**
 * Local history: every save writes a snapshot, so a file can be rolled back even without git.
 * One folder per file (hash of folder + path); snapshot names carry time and content hash.
 */
export class HistoryStore {
	constructor(
		private readonly dir: string,
		private readonly now: () => number = Date.now,
	) {}

	private folder(root: string, rel: string): string {
		return join(this.dir, sha(`${root.toLowerCase()}|${rel}`));
	}

	snapshot(root: string, rel: string, content: string): void {
		if (Buffer.byteLength(content) > MAX_FILE_BYTES) return;
		const folder = this.folder(root, rel);
		mkdirSync(folder, { recursive: true });
		const hash = sha(content).slice(0, 8);
		const existing = this.names(folder);
		// Saving without changes (Ctrl+S spam) adds nothing.
		if (existing[0] && NAME.exec(existing[0])?.[2] === hash) return;
		writeFileSync(join(folder, `${this.now()}-${hash}.txt`), content, 'utf8');
		writeFileSync(join(folder, 'path.txt'), rel, 'utf8');
		this.prune(folder);
	}

	list(root: string, rel: string): Snapshot[] {
		const folder = this.folder(root, rel);
		return this.names(folder).map((name) => {
			const m = NAME.exec(name);
			return {
				id: name.slice(0, -4),
				time: Number(m?.[1] ?? 0),
				size: statSync(join(folder, name)).size,
			};
		});
	}

	read(root: string, rel: string, id: string): string {
		const file = join(this.folder(root, rel), `${id}.txt`);
		if (!NAME.test(`${id}.txt`) || !existsSync(file))
			throw new AnvilError('HISTORY_NOT_FOUND', 'That snapshot no longer exists');
		return readFileSync(file, 'utf8');
	}

	clear(root: string, rel: string): void {
		rmSync(this.folder(root, rel), { recursive: true, force: true });
	}

	/** Newest first. */
	private names(folder: string): string[] {
		if (!existsSync(folder)) return [];
		return readdirSync(folder)
			.filter((n) => NAME.test(n))
			.sort()
			.reverse();
	}

	private prune(folder: string): void {
		const cutoff = this.now() - MAX_AGE_MS;
		this.names(folder).forEach((name, i) => {
			const time = Number(NAME.exec(name)?.[1] ?? 0);
			if (i >= MAX_PER_FILE || time < cutoff) unlinkSync(join(folder, name));
		});
	}
}

export function createHistory(dir: string): HistoryStore {
	return new HistoryStore(dir);
}

export function historyFeature(store: HistoryStore): MainFeature {
	return {
		id: 'history',
		activate(ctx) {
			const root = (): string => {
				const r = ctx.workspace.root();
				if (!r) throw new AnvilError('NO_WORKSPACE', 'No folder is open');
				return r;
			};
			ctx.ipc.handle('history:list', (path) => store.list(root(), path));
			ctx.ipc.handle('history:read', ({ path, id }) => ({
				content: store.read(root(), path, id),
			}));
			ctx.ipc.handle('history:clear', (path) => store.clear(root(), path));
		},
	};
}
