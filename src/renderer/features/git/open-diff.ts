import type { GitChange } from '@shared/ipc/channels/git';

import { call } from '../../lib/ipc';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { getModel, languageOverride } from '../editor/file-ops';
import { languageForFile } from './diff-language';

/**
 * Diff highlighting: the open buffer's language (what the editor shows), else the editor's own
 * cousins for grammar-less files, else Monaco's registry by file name.
 */
export function diffLanguage(name: string, workspacePath: string | null): string | null {
	const open = workspacePath ? getModel(workspacePath) : null;
	if (open) return open.getLanguageId();
	return (
		languageOverride(name) ??
		languageForFile(name, getLoadedMonaco()?.languages.getLanguages() ?? null)
	);
}

export const baseName = (path: string): string => path.split('/').at(-1) ?? path;

/** Opens a git change as a diff tab (HEAD/index vs working tree). */
export async function openDiff(change: GitChange, staged: boolean): Promise<void> {
	const name = baseName(change.path);
	try {
		const d = await call('git:diff', {
			path: change.path,
			staged,
			...(change.from ? { from: change.from } : {}),
		});
		if (d.binary) {
			toast.info('Binary file', `${name} can't be shown as a text diff.`);
			return;
		}
		useTabsStore.getState().open({
			id: `diff:git:${staged ? 'staged' : 'wt'}:${change.path}`,
			kind: 'diff',
			path: null,
			title: `${name} ${staged ? '(staged)' : '(changes)'}`,
			preview: true,
			diff: {
				title: `${change.path} · ${staged ? 'HEAD ↔ index' : 'index ↔ working tree'}`,
				original: d.original,
				modified: d.modified,
				language: diffLanguage(name, change.workspacePath),
				path: change.workspacePath,
			},
		});
	} catch (error) {
		toast.error('Could not load the diff', error instanceof Error ? error.message : undefined);
	}
}
