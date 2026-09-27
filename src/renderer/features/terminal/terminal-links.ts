import type { IDisposable, Terminal } from '@xterm/xterm';

import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { requestOpenFile } from '../../stores/workbench-store';
import { type FileLink, findFileLinks } from './file-links';

function parentOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * The file `path` names in the open folder, spelled as on disk, or null when there is none.
 * Answered from the explorer's folder listings: they are cached and kept fresh by the file
 * watcher, so hovering over output costs at most one small listing per folder.
 */
export async function existingFile(root: string, path: string): Promise<string | null> {
	const dir = parentOf(path);
	try {
		const entries = await queryClient.fetchQuery({
			queryKey: fsKeys.list(root, dir),
			queryFn: () => call('fs:list', dir),
			staleTime: Infinity,
		});
		// Windows paths are case-insensitive: a traceback may spell the folder in lower case.
		const lower = path.toLowerCase();
		return (
			entries.find((e) => e.kind === 'file' && e.path.toLowerCase() === lower)?.path ?? null
		);
	} catch {
		// Most text that looks like `pkg/mod.py:3` names a folder that doesn't exist here; a
		// listing that fails simply means there is nothing to link to.
		return null;
	}
}

/** The candidates whose file exists, in their original order, with the path as on disk. */
export async function keepExisting(
	candidates: readonly FileLink[],
	resolve: (path: string) => Promise<string | null>,
): Promise<FileLink[]> {
	const found = await Promise.all(candidates.map((l) => resolve(l.path)));
	return candidates.flatMap((l, i) => {
		const path = found[i];
		return path ? [{ ...l, path }] : [];
	});
}

/**
 * Makes tracebacks and `file.py:12:5` references in `term` open the file at that line, but only
 * for files that exist. `cwd()` is the folder the terminal started in, for relative paths.
 */
export function registerFileLinks(term: Terminal, cwd: () => string): IDisposable {
	return term.registerLinkProvider({
		provideLinks(y, callback) {
			const root = queryClient.getQueryData<{ root: string | null }>(WORKSPACE_KEY)?.root;
			const text = term.buffer.active.getLine(y - 1)?.translateToString(true) ?? '';
			const candidates = root && text ? findFileLinks(text, root, cwd()) : [];
			if (!root || candidates.length === 0) {
				callback(undefined);
				return;
			}
			void keepExisting(candidates, (path) => existingFile(root, path)).then((links) =>
				callback(
					links.length === 0
						? undefined
						: links.map((l) => ({
								range: { start: { x: l.start + 1, y }, end: { x: l.end, y } },
								text: text.slice(l.start, l.end),
								decorations: { underline: true, pointerCursor: true },
								activate: () => {
									requestOpenFile({
										path: l.path,
										line: l.line,
										column: l.column,
									});
								},
							})),
				),
			);
		},
	});
}
