import { existsSync } from 'node:fs';
import { cp, lstat, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, sep } from 'node:path';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { AnvilError } from '../errors';
import { mapFsError } from './fs-errors';
import { assertRealInside, toAbsolute, toRelative } from './fs-guard';

/**
 * Moving and copying inside the workspace (explorer drag and drop, cut / copy / paste,
 * duplicate). Kept apart from FsService so its edits and these stay independent.
 */
export interface TransferHost {
	/** Sends a replaced item to the Recycle Bin: an overwrite must never be a hard delete. */
	trash(absPath: string): Promise<void>;
}

/** Describes an item after the operation, as fs:list does (a link by its target's kind). */
async function entry(root: string, abs: string): Promise<FsEntry> {
	const link = await lstat(abs);
	const s = link.isSymbolicLink() ? await stat(abs).catch(() => link) : link;
	return {
		name: basename(abs),
		path: toRelative(root, abs),
		kind: s.isSymbolicLink() ? 'symlink' : s.isDirectory() ? 'dir' : 'file',
		isLink: link.isSymbolicLink(),
		size: s.size,
		mtimeMs: s.mtimeMs,
	};
}

/**
 * The name a pasted or duplicated item gets in a folder that already has `name`, VS Code style:
 * `bt.py` → `bt copy.py` → `bt copy 2.py`. Folders and dotfiles keep their whole name as the
 * stem (`v1.2` → `v1.2 copy`, `.env` → `.env copy`). `taken` holds lower-cased names, since
 * Windows names are case-insensitive.
 */
export function copyName(name: string, isDir: boolean, taken: ReadonlySet<string>): string {
	if (!taken.has(name.toLowerCase())) return name;
	const dot = isDir ? -1 : name.lastIndexOf('.');
	const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
	for (let n = 1; ; n++) {
		const candidate = `${stem} copy${n === 1 ? '' : ` ${n}`}${ext}`;
		if (!taken.has(candidate.toLowerCase())) return candidate;
	}
}

/** Whether `inner` is `outer` itself or lies inside it. */
function within(inner: string, outer: string): boolean {
	const back = relative(outer, inner);
	return back === '' || (back !== '..' && !back.startsWith(`..${sep}`) && !isAbsolute(back));
}

/** The folder `from` may go into: inside the workspace, existing, and never `from` itself. */
async function targetDir(
	root: string,
	targetRel: string,
	from: string,
	verb: 'moved' | 'copied',
): Promise<string> {
	const dir = toAbsolute(root, targetRel);
	assertRealInside(root, dir);
	if (within(dir, from))
		throw new AnvilError('FS_BAD_PATH', `A folder cannot be ${verb} into itself`);
	const s = await stat(dir).catch((error: unknown) => {
		throw mapFsError(error, targetRel, 'open');
	});
	if (!s.isDirectory())
		throw new AnvilError('FS_NOT_A_DIR', `${targetRel || '.'} is not a folder`);
	return dir;
}

/** The workspace item at `rel`, which must not be the root itself. */
function source(root: string, rel: string, verb: string): string {
	const from = toAbsolute(root, rel);
	if (from === root) throw new AnvilError('FS_BAD_PATH', `Cannot ${verb} the workspace root`);
	// A link itself may be moved, but not an item reached through a link that leaves the folder.
	assertRealInside(root, join(from, '..'));
	return from;
}

/**
 * Moves a file or folder into `targetRel`. A same-named item there is only replaced when
 * `overwrite` is set, and then goes to the Recycle Bin first. Moving into its own folder is a
 * no-op.
 */
export async function moveItem(
	host: TransferHost,
	root: string,
	rel: string,
	targetRel: string,
	overwrite: boolean,
): Promise<FsEntry> {
	const from = source(root, rel, 'move');
	const dir = await targetDir(root, targetRel, from, 'moved');
	const to = join(dir, basename(from));
	assertRealInside(root, to);
	if (relative(from, to) === '') return entry(root, to);
	try {
		if (existsSync(to)) {
			if (!overwrite)
				throw new AnvilError(
					'FS_EXISTS',
					`"${basename(from)}" already exists in ${targetRel || 'the folder root'}`,
				);
			await host.trash(to);
		}
		try {
			await rename(from, to);
		} catch (error) {
			// Another drive behind a junction: rename can't cross volumes, so copy then remove.
			if (!(error instanceof Error && 'code' in error && error.code === 'EXDEV')) throw error;
			await cp(from, to, { recursive: true, errorOnExist: true, force: false });
			await rm(from, { recursive: true, force: true });
		}
		return await entry(root, to);
	} catch (error) {
		throw mapFsError(error, rel, 'move');
	}
}

/** Copies a file or folder (recursively) into `targetRel`; a clash is named "<name> copy". */
export async function copyItem(
	host: TransferHost,
	root: string,
	rel: string,
	targetRel: string,
): Promise<FsEntry> {
	const from = source(root, rel, 'copy');
	const dir = await targetDir(root, targetRel, from, 'copied');
	try {
		const taken = new Set((await readdir(dir)).map((n) => n.toLowerCase()));
		const isDir = (await lstat(from)).isDirectory();
		const to = join(dir, copyName(basename(from), isDir, taken));
		assertRealInside(root, to);
		await cp(from, to, { recursive: true, errorOnExist: true, force: false });
		return await entry(root, to);
	} catch (error) {
		throw mapFsError(error, rel, 'copy');
	}
}
