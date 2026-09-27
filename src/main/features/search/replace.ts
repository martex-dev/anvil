import { randomBytes } from 'node:crypto';
import { readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { ReplaceResult, SearchQuery } from '@shared/ipc/channels/search';
import { buildReplaceRegex, replaceOnLines } from '@shared/search-replace';

import { AnvilError, errorMessage } from '../../core/errors';
import { assertRealInside, toAbsolute } from '../../core/workspace/fs-guard';
import { looksBinary, MAX_EDITABLE_BYTES } from '../../core/workspace/fs-service';
import { decodeText, encodeText } from '../../core/workspace/text-codec';

export interface ReplaceFile {
	/** Relative to the open folder. */
	path: string;
	/** 1-based lines the user saw matches on. */
	lines: number[];
	/** mtime the search recorded; a different one means the file changed since. */
	mtimeMs?: number | undefined;
}

export const CHANGED = 'changed since the search';

/**
 * Writes through a temp file in the same folder and a rename, so a crash or a full disk mid-write
 * never leaves a half-written source file. The file's permission bits are kept.
 */
async function writeAtomic(abs: string, bytes: Buffer, mode: number): Promise<void> {
	const tmp = join(dirname(abs), `.${basename(abs)}.anvil-${randomBytes(4).toString('hex')}.tmp`);
	try {
		await writeFile(tmp, bytes, { mode });
		await rename(tmp, abs);
	} catch (error) {
		await rm(tmp, { force: true }).catch(() => undefined);
		throw error;
	}
}

/**
 * Replaces the search's matches in files on disk. Each file is re-read through the workspace
 * guard, decoded the way the editor's file layer does (UTF-8 or Windows-1252, BOM kept), and the
 * query is re-applied as a JavaScript regex on the lines the user saw. Anything that no longer
 * looks like the search result (newer mtime, a listed line without a match) is skipped and
 * reported rather than guessed at.
 */
export async function replaceInFiles(
	root: string,
	query: SearchQuery,
	replacement: string,
	files: readonly ReplaceFile[],
): Promise<ReplaceResult> {
	try {
		buildReplaceRegex(query);
	} catch (error) {
		// Valid for ripgrep but not for JavaScript (rare Rust-only syntax): refuse up front.
		throw new AnvilError(
			'SEARCH_BAD_QUERY',
			`This pattern can't be used to replace: ${errorMessage(error)}`,
		);
	}
	const result: ReplaceResult = { replaced: 0, files: [], skipped: [] };
	const skip = (path: string, reason: string): void => {
		result.skipped.push({ path, reason });
	};
	for (const file of files) {
		try {
			const abs = toAbsolute(root, file.path);
			assertRealInside(root, abs);
			const s = await stat(abs);
			// 1 ms tolerance: some filesystems round mtimes (the same rule as saving).
			if (file.mtimeMs !== undefined && Math.abs(s.mtimeMs - file.mtimeMs) > 1) {
				skip(file.path, CHANGED);
				continue;
			}
			if (s.size > MAX_EDITABLE_BYTES) {
				skip(file.path, 'too large to edit');
				continue;
			}
			const buf = await readFile(abs);
			if (looksBinary(buf)) {
				skip(file.path, 'binary');
				continue;
			}
			const { text, encoding, bom } = decodeText(buf);
			const edit = replaceOnLines(text, file.lines, query, replacement);
			if (edit.stale.length > 0) {
				skip(file.path, CHANGED);
				continue;
			}
			// Through a link, the target is rewritten; renaming over the link would replace it.
			const target = await realpath(abs);
			await writeAtomic(target, encodeText(edit.text, encoding, bom, file.path), s.mode);
			result.replaced += edit.count;
			result.files.push(file.path);
		} catch (error) {
			skip(file.path, errorMessage(error));
		}
	}
	return result;
}
