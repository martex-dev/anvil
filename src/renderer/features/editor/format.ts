import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../app/hooks/use-settings';
import { call, IpcCallError } from '../../lib/ipc';
import { toast, useToastStore } from '../../stores/toast-store';
import { replaceText } from './buffers';

/** Whitespace hygiene on save, as one undoable edit. */
export function cleanWhitespace(model: Monaco.editor.ITextModel): void {
	const { trimTrailingWhitespace, insertFinalNewline } = getSettings();
	if (!trimTrailingWhitespace && !insertFinalNewline) return;
	const before = model.getValue();
	const eol = model.getEOL();
	let after = before;
	if (trimTrailingWhitespace) after = after.replace(/[ \t]+(?=\r?\n|$)/g, '');
	if (insertFinalNewline && after.length > 0 && !after.endsWith('\n')) after += eol;
	if (after !== before) replaceText(model, after);
}

/** The last format warning on screen, replaced by the next so repeated saves don't stack. */
let lastWarning: number | null = null;
/** A missing ruff is reported once per session on save: it won't fix itself between saves. */
let missingRuffReported = false;

function warnFormat(title: string, description: string | undefined): void {
	if (lastWarning !== null) useToastStore.getState().dismiss(lastWarning);
	lastWarning = toast.warn(title, description);
}

/**
 * Formats a Python buffer with ruff in place, as one undoable edit. A formatting failure
 * (syntax error, ruff missing) is reported but never blocks the save itself. With `onSave`, a
 * missing ruff is reported once per session, with how to install it or turn the setting off.
 */
export async function formatPython(
	path: string,
	model: Monaco.editor.ITextModel,
	options: { onSave?: boolean } = {},
): Promise<boolean> {
	try {
		const before = model.getValue();
		const { content } = await call('python:format', { path, content: before });
		if (content !== before && model.getValue() === before) replaceText(model, content);
		return true;
	} catch (error) {
		const missingRuff = error instanceof IpcCallError && error.code === 'PY_NO_RUFF';
		if (!missingRuff || !options.onSave)
			warnFormat('Format skipped', error instanceof Error ? error.message : undefined);
		else if (!missingRuffReported) {
			missingRuffReported = true;
			warnFormat(
				'Format on save needs ruff',
				'Install it with `uv add --dev ruff` or `pip install ruff`, or turn off "Format Python on save" in Settings → Editor.',
			);
		}
		return false;
	}
}
