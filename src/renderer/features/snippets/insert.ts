import type * as Monaco from 'monaco-editor';

import { focusedEditor } from '../../lib/monaco/editors';
import { toast } from '../../stores/toast-store';
import type { Snippet } from './library';

/** Monaco's built-in snippet controller; not in the public typings, but stable since 2017. */
interface SnippetController extends Monaco.editor.IEditorContribution {
	insert(template: string): void;
}

/**
 * Inserts at the cursor of the editor the user was last in, with live tab stops. Returns false
 * (after telling the user why) when there is no code editor to insert into.
 */
export function insertSnippet(snippet: Snippet): boolean {
	const editor = focusedEditor();
	if (!editor) {
		toast.info('Open a file to insert a snippet');
		return false;
	}
	// Focus first: the snippet session ends as soon as the editor loses focus.
	editor.focus();
	const controller = editor.getContribution<SnippetController>('snippetController2');
	controller?.insert(snippet.body);
	return true;
}
