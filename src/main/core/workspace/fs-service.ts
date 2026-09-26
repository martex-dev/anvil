import { existsSync, type Stats } from 'node:fs';
import { lstat, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

import type { FileContent, FsEntry, FsStat, TextEncoding } from '@shared/ipc/channels/fs';

import { AnvilError } from '../errors';
import { mapFsError } from './fs-errors';
import { assertRealInside, toAbsolute, toRelative, validateName } from './fs-guard';
import { decodeText, encodeText } from './text-codec';

export const MAX_EDITABLE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
	'.ico': 'image/x-icon',
	'.svg': 'image/svg+xml',
};

export interface FsHost {
	getRoot(): string | null;
	trash(absPath: string): Promise<void>;
	reveal(absPath: string): void;
}

/** Heuristic used by git and most editors: a NUL byte in the first 8 KB means binary. */
export function looksBinary(buf: Buffer): boolean {
	const n = Math.min(buf.length, 8192);
	for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
	return false;
}

/** Kind of a (followed) stat; still a link only when the target could not be resolved. */
function kindOf(s: Stats): FsEntry['kind'] {
	if (s.isSymbolicLink()) return 'symlink';
	return s.isDirectory() ? 'dir' : 'file';
}

function detectEol(text: string): '\n' | '\r\n' {
	const crlf = text.indexOf('\r\n');
	const lf = text.indexOf('\n');
	return crlf !== -1 && crlf < lf + 1 ? '\r\n' : '\n';
}

const EMPTY_TEXT = {
	content: '',
	binary: false,
	tooLarge: false,
	eol: '\n',
	bom: false,
	encoding: 'utf8',
} as const satisfies Partial<FileContent>;

/** Workspace-scoped file operations. Every path goes through the guard first. */
export class FsService {
	constructor(private readonly host: FsHost) {}

	private root(): string {
		const root = this.host.getRoot();
		if (!root) throw new AnvilError('NO_WORKSPACE', 'No folder is open');
		return root;
	}

	async list(rel: string): Promise<FsEntry[]> {
		const root = this.root();
		const dir = toAbsolute(root, rel);
		const dirents = await readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
			throw new AnvilError('FS_READ_FAILED', `Cannot list "${rel || '.'}"`, error);
		});
		const entries = await Promise.all(
			dirents.map(async (d): Promise<FsEntry | null> => {
				const abs = join(dir, d.name);
				try {
					// Links (incl. junctions) are described by their target, so linked data
					// folders expand like any other; only a dangling link stays 'symlink'.
					const s = d.isSymbolicLink()
						? await stat(abs).catch(() => lstat(abs))
						: await lstat(abs);
					return {
						name: d.name,
						path: toRelative(root, abs),
						kind: kindOf(s),
						isLink: d.isSymbolicLink(),
						size: s.size,
						mtimeMs: s.mtimeMs,
					};
				} catch {
					// Vanished between readdir and stat, or locked system file: skip it.
					return null;
				}
			}),
		);
		return entries
			.filter((e): e is FsEntry => e !== null)
			.sort((a, b) => {
				// Links to folders have kind 'dir' (see list), so they sort with folders.
				const ad = a.kind === 'dir' ? 0 : 1;
				const bd = b.kind === 'dir' ? 0 : 1;
				return (
					ad - bd ||
					a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
				);
			});
	}

	/** Follows symlinks, like readFile, so a linked file stats as the file it points to. */
	async stat(rel: string): Promise<FsStat> {
		const abs = toAbsolute(this.root(), rel);
		const s = await stat(abs).catch((error: unknown) => {
			throw new AnvilError('FS_NOT_FOUND', `Not found: ${rel}`, error);
		});
		return {
			kind: s.isDirectory() ? 'dir' : 'file',
			size: s.size,
			mtimeMs: s.mtimeMs,
			ctimeMs: s.ctimeMs,
		};
	}

	async readFile(rel: string): Promise<FileContent> {
		const abs = toAbsolute(this.root(), rel);
		const s = await stat(abs).catch((error: unknown) => {
			throw new AnvilError('FS_NOT_FOUND', `File not found: ${rel}`, error);
		});
		if (!s.isFile()) throw new AnvilError('FS_NOT_A_FILE', `${rel} is not a file`);
		const base = { path: rel, size: s.size, mtimeMs: s.mtimeMs };
		if (s.size > MAX_EDITABLE_BYTES) {
			return { ...base, ...EMPTY_TEXT, tooLarge: true };
		}
		const buf = await readFile(abs).catch((error: unknown) => {
			throw mapFsError(error, rel, 'open');
		});
		if (looksBinary(buf)) return { ...base, ...EMPTY_TEXT, binary: true };
		// The BOM is stripped so the editor doesn't show it, but reported (with the encoding) so
		// a save writes the same bytes back: Excel CSVs and PowerShell 5 scripts depend on it.
		const { text, encoding, bom } = decodeText(buf);
		return {
			...base,
			content: text,
			binary: false,
			tooLarge: false,
			eol: detectEol(text),
			bom,
			encoding,
		};
	}

	async writeFile(
		rel: string,
		content: string,
		expectedMtimeMs?: number,
		bom = false,
		encoding: TextEncoding = 'utf8',
	): Promise<{ mtimeMs: number }> {
		const root = this.root();
		const abs = toAbsolute(root, rel);
		assertRealInside(root, abs);
		try {
			if (expectedMtimeMs !== undefined && existsSync(abs)) {
				const current = (await stat(abs)).mtimeMs;
				// 1 ms tolerance: some filesystems round mtimes.
				if (Math.abs(current - expectedMtimeMs) > 1) {
					throw new AnvilError(
						'FS_CONFLICT',
						`${rel} changed on disk since it was opened`,
					);
				}
			}
			await writeFile(abs, encodeText(content, encoding, bom, rel));
			return { mtimeMs: (await stat(abs)).mtimeMs };
		} catch (error) {
			throw mapFsError(error, rel, 'save');
		}
	}

	async create(parentRel: string, name: string, kind: 'file' | 'dir'): Promise<FsEntry> {
		validateName(name);
		const root = this.root();
		const abs = join(toAbsolute(root, parentRel), name);
		toAbsolute(root, toRelative(root, abs));
		assertRealInside(root, abs);
		if (existsSync(abs)) throw new AnvilError('FS_EXISTS', `"${name}" already exists`);
		try {
			if (kind === 'dir') await mkdir(abs);
			else await writeFile(abs, '', { encoding: 'utf8', flag: 'wx' });
			return await this.entry(root, abs);
		} catch (error) {
			throw mapFsError(error, toRelative(root, abs), 'create');
		}
	}

	async rename(rel: string, newName: string): Promise<FsEntry> {
		validateName(newName);
		const root = this.root();
		const from = toAbsolute(root, rel);
		if (from === root) throw new AnvilError('FS_BAD_PATH', 'Cannot rename the workspace root');
		// A link itself may be renamed, but not a file reached through a link that leaves the
		// folder (that would change files outside it). Reads through links stay allowed.
		assertRealInside(root, dirname(from));
		const to = join(dirname(from), newName);
		assertRealInside(root, to);
		// Case-only renames on Windows report the target as existing (same file); allow those.
		if (existsSync(to) && basename(from).toLowerCase() !== newName.toLowerCase()) {
			throw new AnvilError('FS_EXISTS', `"${newName}" already exists`);
		}
		try {
			await rename(from, to);
			return await this.entry(root, to);
		} catch (error) {
			throw mapFsError(error, rel, 'rename');
		}
	}

	async trash(rel: string): Promise<void> {
		const root = this.root();
		const abs = toAbsolute(root, rel);
		if (abs === root) throw new AnvilError('FS_BAD_PATH', 'Cannot delete the workspace root');
		// Same rule as rename: trashing a link is fine, trashing through one is not.
		assertRealInside(root, dirname(abs));
		await this.host.trash(abs);
	}

	/** Absolute path of a workspace file (for "Copy Path" and running it). */
	absolute(rel: string): string {
		return toAbsolute(this.root(), rel);
	}

	async readDataUrl(rel: string): Promise<{ url: string; size: number }> {
		const abs = toAbsolute(this.root(), rel);
		const mime = IMAGE_MIME[extname(abs).toLowerCase()];
		if (!mime) throw new AnvilError('FS_NOT_IMAGE', `${basename(abs)} is not an image`);
		const s = await stat(abs).catch((error: unknown) => {
			throw mapFsError(error, rel, 'open');
		});
		if (s.size > MAX_IMAGE_BYTES)
			throw new AnvilError('FS_TOO_LARGE', `${basename(abs)} is larger than 25 MB`);
		const buf = await readFile(abs).catch((error: unknown) => {
			throw mapFsError(error, rel, 'open');
		});
		return { url: `data:${mime};base64,${buf.toString('base64')}`, size: s.size };
	}

	reveal(rel: string): void {
		this.host.reveal(toAbsolute(this.root(), rel));
	}

	private async entry(root: string, abs: string): Promise<FsEntry> {
		const link = await lstat(abs);
		const s = link.isSymbolicLink() ? await stat(abs).catch(() => link) : link;
		return {
			name: basename(abs),
			path: toRelative(root, abs),
			kind: kindOf(s),
			isLink: link.isSymbolicLink(),
			size: s.size,
			mtimeMs: s.mtimeMs,
		};
	}
}
