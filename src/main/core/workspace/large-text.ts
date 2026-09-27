import { readFile, stat } from 'node:fs/promises';

import type { FileContent } from '@shared/ipc/channels/fs';

import { AnvilError } from '../errors';
import { mapFsError } from './fs-errors';
import { toAbsolute } from './fs-guard';
import { looksBinary } from './fs-service';
import { decodeText } from './text-codec';

/**
 * The cap for read-only viewers. Notebooks carry their plots as base64, so the editor's 5 MB is
 * routinely exceeded, while 50 MB of JSON still parses in well under a second.
 */
export const MAX_VIEWER_BYTES = 50 * 1024 * 1024;

/**
 * Reads a workspace file as text for a viewer that only parses it (never edits or saves it), with
 * the higher viewer cap instead of the editor's. `tooLarge` is set beyond MAX_VIEWER_BYTES.
 */
export async function readLargeText(root: string, rel: string): Promise<FileContent> {
	const abs = toAbsolute(root, rel);
	const s = await stat(abs).catch((error: unknown) => {
		throw mapFsError(error, rel, 'open');
	});
	if (!s.isFile()) throw new AnvilError('FS_NOT_A_FILE', `${rel} is not a file`);
	const empty = {
		path: rel,
		size: s.size,
		mtimeMs: s.mtimeMs,
		content: '',
		eol: '\n',
		bom: false,
		encoding: 'utf8',
	} as const;
	if (s.size > MAX_VIEWER_BYTES) return { ...empty, binary: false, tooLarge: true };
	const buf = await readFile(abs).catch((error: unknown) => {
		throw mapFsError(error, rel, 'open');
	});
	if (looksBinary(buf)) return { ...empty, binary: true, tooLarge: false };
	const { text, encoding, bom } = decodeText(buf);
	return {
		...empty,
		content: text,
		binary: false,
		tooLarge: false,
		eol: text.includes('\r\n') ? '\r\n' : '\n',
		bom,
		encoding,
	};
}
