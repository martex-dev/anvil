import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../lib/monaco/setup';

/**
 * Follows the inline edit's target while the box is open: typing above it moves it, typing
 * inside it resizes it. Nothing is drawn; the range is only tracked.
 */
export function trackRange(
	monaco: MonacoApi | null,
	editor: Monaco.editor.IStandaloneCodeEditor,
	range: Monaco.IRange,
): Monaco.editor.IEditorDecorationsCollection {
	return editor.createDecorationsCollection([
		{
			range,
			options: {
				// Typing just outside the target stays outside it.
				stickiness: monaco?.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
			},
		},
	]);
}

/**
 * Where the target is now, snapped back to whole lines for a line edit. Null when the code it
 * covered was deleted, so there is nothing left to replace.
 */
export function currentRange(
	tracker: Pick<Monaco.editor.IEditorDecorationsCollection, 'getRange'>,
	model: Pick<Monaco.editor.ITextModel, 'getLineMaxColumn'>,
	started: Monaco.IRange,
): Monaco.IRange | null {
	const now = tracker.getRange(0);
	if (!now) return null;
	const insert =
		started.startLineNumber === started.endLineNumber &&
		started.startColumn === started.endColumn;
	if (insert)
		return {
			startLineNumber: now.startLineNumber,
			startColumn: now.startColumn,
			endLineNumber: now.startLineNumber,
			endColumn: now.startColumn,
		};
	if (now.startLineNumber === now.endLineNumber && now.startColumn === now.endColumn) return null;
	return {
		startLineNumber: now.startLineNumber,
		startColumn: 1,
		endLineNumber: now.endLineNumber,
		endColumn: model.getLineMaxColumn(now.endLineNumber),
	};
}
