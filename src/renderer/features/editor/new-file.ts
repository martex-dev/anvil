import { call, IpcCallError } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { quickPick } from '../../ui/QuickPick';

const isExists = (error: unknown): boolean =>
	error instanceof IpcCallError && error.code === 'FS_EXISTS';

/** "src\strategy\momentum.py" → folders and file name; null if there's no usable file name. */
export function splitNewPath(text: string): { dirs: string[]; name: string } | null {
	const parts = text.trim().replace(/\\/g, '/').replace(/^\/+/, '').split('/');
	const name = parts.pop() ?? '';
	if (!name || parts.some((p) => p === '')) return null;
	return { dirs: parts, name };
}

/**
 * Creates `rel` (and any missing folders), then opens it. A file that already exists is simply
 * opened; any other failure (bad name, permissions) is reported where it happened.
 */
export async function createFileAt(rel: string): Promise<void> {
	const split = splitNewPath(rel);
	if (!split) {
		toast.warn('Enter a file name', 'e.g. src/strategy/momentum.py (not ending in a slash)');
		return;
	}
	let parent = '';
	for (const dir of split.dirs) {
		try {
			await call('fs:create', { parent, name: dir, kind: 'dir' });
		} catch (error) {
			// Existing folders are fine; create only what's missing.
			if (!isExists(error)) {
				toast.error(
					`Could not create the folder "${dir}"`,
					error instanceof Error ? error.message : undefined,
				);
				return;
			}
		}
		parent = parent ? `${parent}/${dir}` : dir;
	}
	const path = parent ? `${parent}/${split.name}` : split.name;
	try {
		const entry = await call('fs:create', { parent, name: split.name, kind: 'file' });
		requestOpenFile({ path: entry.path });
	} catch (error) {
		if (isExists(error)) {
			requestOpenFile({ path });
			return;
		}
		toast.error(
			'Could not create the file',
			error instanceof Error ? error.message : undefined,
		);
	}
}

export async function newFile(): Promise<void> {
	const picked = await quickPick({
		title: 'new file',
		placeholder: 'Path relative to the folder, e.g. src/strategy/momentum.py',
		items: [],
		allowCustom: { label: (text) => `Create ${text}` },
	});
	if (picked?.startsWith('custom:')) await createFileAt(picked.slice(7));
}
