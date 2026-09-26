import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
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

/**
 * Formats a Python buffer with ruff in place, as one undoable edit. A formatting failure
 * (syntax error, ruff missing) is reported but never blocks the save itself.
 */
export async function formatPython(
	path: string,
	model: Monaco.editor.ITextModel,
): Promise<boolean> {
	try {
		const before = model.getValue();
		const { content } = await call('python:format', { path, content: before });
		if (content !== before && model.getValue() === before) replaceText(model, content);
		return true;
	} catch (error) {
		toast.warn('Format skipped', error instanceof Error ? error.message : undefined);
		return false;
	}
}
