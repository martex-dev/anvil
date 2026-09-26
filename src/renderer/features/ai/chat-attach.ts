import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { useChat } from './chat-store';
import {
	activeEditor,
	fileContext,
	MAX_FILE,
	selectionContext,
	truncateForContext,
} from './editor-context';

/** Attaches the open file or its selection to the next message. */
export function attachCurrent(kind: 'file' | 'selection'): boolean {
	const editor = activeEditor();
	if (!editor) {
		toast.warn('No file open', 'Open a file in the editor to attach it.');
		return false;
	}
	const item = kind === 'file' ? fileContext(editor) : selectionContext(editor);
	if (!item) {
		toast.warn('Nothing selected', 'Select some code in the editor first.');
		return false;
	}
	useChat.getState().attach(item);
	return true;
}

/** Attaches the working tree's diff against HEAD. */
export async function attachDiff(): Promise<void> {
	try {
		const { diff, truncated } = await call('ai:gitDiff', { staged: false });
		if (!diff.trim()) {
			toast.info(
				'No changes',
				'Tracked files match HEAD. New untracked files are not part of git diff.',
			);
			return;
		}
		useChat.getState().attach({
			kind: 'diff',
			label: truncated ? 'git diff (truncated)' : 'git diff',
			language: 'diff',
			text: diff,
		});
	} catch (error) {
		toast.error(
			'Could not read git diff',
			error instanceof Error ? error.message : String(error),
		);
	}
}

/** Attaches a workspace file picked with `@`. */
export async function attachPath(path: string): Promise<void> {
	try {
		const file = await call('fs:readFile', path);
		if (file.binary || file.tooLarge) {
			toast.warn('Not attached', `${path} is ${file.binary ? 'binary' : 'too large'}.`);
			return;
		}
		const { text, truncated } = truncateForContext(file.content);
		if (truncated) {
			toast.info(
				'Attached part of the file',
				`${path} was cut to its first ${MAX_FILE.toLocaleString()} characters.`,
			);
		}
		useChat.getState().attach({ kind: 'file', label: path, language: null, text });
	} catch (error) {
		toast.error('Could not attach', error instanceof Error ? error.message : undefined);
	}
}
