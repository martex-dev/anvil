import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { MAX_LINES, prepareSnapCode } from './snap-layout';
import { useSnap } from './snap-store';

function fileNameOf(uri: { scheme: string; fsPath: string; path: string }): string {
	const path = toWorkspacePath(uri) ?? uri.path;
	return path.split(/[\\/]/).pop() || 'untitled';
}

/** Snaps the focused editor's selection (whole lines), or the whole file when nothing is selected. */
export function openSnapFromEditor(): void {
	const editor = focusedEditor();
	const model = editor?.getModel();
	if (!editor || !model) {
		toast.info('Open a file to snap it');
		return;
	}

	let start = 1;
	let end = model.getLineCount();
	const selection = editor.getSelection();
	const fromSelection = selection !== null && !selection.isEmpty();
	if (fromSelection) {
		start = selection.startLineNumber;
		end = selection.endLineNumber;
		// A drag that ends at column 1 of the next line didn't mean to include that line.
		if (end > start && selection.endColumn === 1) end -= 1;
	}
	const capped = end - start + 1 > MAX_LINES;
	if (capped) end = start + MAX_LINES - 1;

	const lines: string[] = [];
	for (let line = start; line <= end; line++) lines.push(model.getLineContent(line));
	const { code, startLine } = prepareSnapCode(lines, start, model.getOptions().tabSize);
	if (code === '') {
		toast.info(
			'Nothing to snap',
			fromSelection ? 'The selection is blank.' : 'The file is empty.',
		);
		return;
	}
	if (capped) toast.info(`Snap capped at ${MAX_LINES} lines`);

	useSnap.getState().openSnap({
		code,
		language: model.getLanguageId(),
		title: fileNameOf(model.uri),
		startLine,
	});
}
