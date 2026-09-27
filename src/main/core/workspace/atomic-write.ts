import { randomBytes } from 'node:crypto';
import type { Stats } from 'node:fs';
import { open, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { AnvilError } from '../errors';

/** Ends the name of the temp file a save writes next to its target; the watcher ignores it. */
export const SAVE_TEMP_SUFFIX = '.anvil-save';

/** A scanner, the indexer or OneDrive holding the file for a moment: worth waiting for. */
const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_DELAYS_MS = [20, 50, 100, 200, 400];

const codeOf = (error: unknown): string =>
	error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : '';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The filesystem calls that can fail transiently; injectable so tests can simulate a lock. */
export interface AtomicWriteOps {
	rename(from: string, to: string): Promise<void>;
	delaysMs: readonly number[];
}

const defaultOps: AtomicWriteOps = { rename, delaysMs: RENAME_DELAYS_MS };

async function renameWithRetry(from: string, to: string, ops: AtomicWriteOps): Promise<void> {
	for (let attempt = 0; ; attempt++) {
		try {
			await ops.rename(from, to);
			return;
		} catch (error) {
			const delay = ops.delaysMs[attempt];
			if (delay === undefined || !TRANSIENT.has(codeOf(error))) throw error;
			await sleep(delay);
		}
	}
}

/** Writes and flushes to disk, so a power cut after the rename can't leave an empty file. */
async function writeDurably(path: string, data: Uint8Array, mode: number): Promise<void> {
	const handle = await open(path, 'wx', mode);
	try {
		await handle.writeFile(data);
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function existing(path: string): Promise<{ target: string; stats: Stats } | null> {
	try {
		// A symlinked file is saved at its target, so the link itself survives the rename.
		const target = await realpath(path);
		return { target, stats: await stat(target) };
	} catch (error) {
		if (codeOf(error) === 'ENOENT') return null;
		throw error;
	}
}

/**
 * Saves `data` so that a crash, taskkill or power cut mid-save can't leave a truncated file:
 * the bytes go to a sibling temp file, which then replaces the target in one rename.
 *
 * - A rename over a file that an antivirus scanner or the indexer has open fails with
 *   EPERM/EBUSY for a moment on Windows: it is retried with backoff and, if it keeps failing,
 *   the file is written in place, as before (a save must not fail because Defender is looking).
 * - A hard-linked file (nlink > 1, e.g. installed by uv or pnpm) is written in place: a rename
 *   would split it from its other names.
 * - A read-only file is refused; a rename would quietly replace it on Linux and macOS.
 * - The permission bits are carried over to the replacement.
 */
export async function writeFileAtomic(
	path: string,
	data: Uint8Array,
	ops: AtomicWriteOps = defaultOps,
): Promise<void> {
	const current = await existing(path);
	if (!current) {
		// Nothing to protect yet. `wx` refuses to clobber a file created in the meantime.
		await writeFile(path, data, { flag: 'wx' }).catch(async (error: unknown) => {
			if (codeOf(error) !== 'EEXIST') throw error;
			await writeFileAtomic(path, data, ops);
		});
		return;
	}
	const { target, stats } = current;
	if ((stats.mode & 0o200) === 0) {
		throw new AnvilError(
			'FS_READ_ONLY',
			`${basename(path)} is read-only. Clear its read-only attribute to save it.`,
		);
	}
	if (stats.nlink > 1) {
		await writeFile(target, data);
		return;
	}
	const tmp = join(
		dirname(target),
		`.${basename(target)}.${randomBytes(4).toString('hex')}${SAVE_TEMP_SUFFIX}`,
	);
	try {
		await writeDurably(tmp, data, stats.mode & 0o777);
		await renameWithRetry(tmp, target, ops);
	} catch (error) {
		// A leftover temp file is harmless; the error worth reporting is the save's own.
		await rm(tmp, { force: true }).catch(() => undefined);
		// A folder that allows editing files but not creating them, or a lock that outlasted the
		// retries: overwrite in place. Anything else (disk full...) must not touch the original.
		if (!TRANSIENT.has(codeOf(error))) throw error;
		await writeFile(target, data);
	}
}
