import type * as Monaco from 'monaco-editor';

import { focusedEditor } from '../../lib/monaco/editors';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { useClipboardHistory } from '../editor/extras/clipboard';
import { evaluateSelection } from '../transform/math';
import { TRANSFORMS } from '../transform/transforms';

type Editor = Monaco.editor.IStandaloneCodeEditor;

/** The focused code editor, or a hint toast and null. */
export function requireEditor(): Editor | null {
	const editor = focusedEditor();
	if (!editor) toast.info('Open a file first');
	return editor;
}

type Target = { range: Monaco.IRange; text: string };

/** a is strictly before b (line, then column). */
function before(aLine: number, aCol: number, bLine: number, bCol: number): boolean {
	return aLine < bLine || (aLine === bLine && aCol < bCol);
}

/** Monaco rejects edits whose ranges overlap; touching ranges are fine. */
function overlaps(a: Monaco.IRange, b: Monaco.IRange): boolean {
	const same =
		a.startLineNumber === b.startLineNumber &&
		a.startColumn === b.startColumn &&
		a.endLineNumber === b.endLineNumber &&
		a.endColumn === b.endColumn;
	return (
		same ||
		(before(a.startLineNumber, a.startColumn, b.endLineNumber, b.endColumn) &&
			before(b.startLineNumber, b.startColumn, a.endLineNumber, a.endColumn))
	);
}

/**
 * The text each selection acts on. An empty selection means its whole line, which is what you
 * want for "evaluate this line" or "snake_case this name" without selecting first. A line can be
 * claimed only once (two cursors on it, or a cursor inside another selection), since overlapping
 * edits would make Monaco reject the whole transform; real selections win over whole lines.
 */
function targets(editor: Editor): Target[] {
	const model = editor.getModel();
	if (!model) return [];
	const selections = editor.getSelections() ?? [];
	const kept: Monaco.IRange[] = selections.filter((sel) => !sel.isEmpty());
	const out: Target[] = [];
	for (const sel of selections) {
		let range: Monaco.IRange = sel;
		if (sel.isEmpty()) {
			range = {
				startLineNumber: sel.startLineNumber,
				startColumn: 1,
				endLineNumber: sel.startLineNumber,
				endColumn: model.getLineMaxColumn(sel.startLineNumber),
			};
			if (kept.some((k) => overlaps(k, range))) continue;
			kept.push(range);
		}
		out.push({ range, text: model.getValueInRange(range) });
	}
	return out;
}

/** Replaces every target with `fn(text)` as one undo step; returns false if it failed. */
export function replaceTargets(
	editor: Editor,
	fn: (text: string) => string,
	errorTitle = 'Could not transform',
): boolean {
	const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
	try {
		for (const t of targets(editor)) {
			const next = fn(t.text);
			if (next !== t.text) edits.push({ range: t.range, text: next, forceMoveMarkers: true });
		}
		if (edits.length === 0) return true;
		editor.pushUndoStop();
		editor.executeEdits('anvil.transform', edits);
		editor.pushUndoStop();
	} catch (error) {
		toast.warn(errorTitle, error instanceof Error ? error.message : undefined);
		return false;
	}
	editor.focus();
	return true;
}

/** Types `text` at every cursor, replacing selections. */
export function insertAtCursors(editor: Editor, text: string): void {
	const edits = (editor.getSelections() ?? []).map((range) => ({
		range,
		text,
		forceMoveMarkers: true,
	}));
	editor.pushUndoStop();
	editor.executeEdits('anvil.insert', edits);
	editor.pushUndoStop();
	editor.focus();
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const clip = (s: string, n: number): string => {
	const one = s.replace(/\s+/g, ' ').trim();
	return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

export async function transformSelection(): Promise<void> {
	const editor = requireEditor();
	if (!editor) return;
	// Preview each transform on the real selection when it's small enough to run 46 times.
	const sample = targets(editor)[0]?.text ?? '';
	const live = sample.length > 0 && sample.length <= 2000;
	const picked = await quickPick({
		title: 'transform',
		placeholder: 'snake_case, sort lines, base64, JSON pretty…',
		items: TRANSFORMS.map((t) => {
			let detail = t.example;
			if (live) {
				try {
					detail = clip(t.run(sample), 80);
				} catch {
					detail = `(${t.example})`;
				}
			}
			return {
				id: t.id,
				label: t.label,
				description: t.group,
				detail: detail || '(empty)',
				keywords: [t.group],
			};
		}),
	});
	const transform = TRANSFORMS.find((t) => t.id === picked);
	if (transform) replaceTargets(editor, transform.run);
}

export function evaluateMath(): void {
	const editor = requireEditor();
	if (!editor) return;
	let last = '';
	const ok = replaceTargets(
		editor,
		(text) => {
			const { result, replaced } = evaluateSelection(text);
			last = result;
			return replaced;
		},
		'Not a math expression',
	);
	if (ok && last) toast.success(`= ${last}`);
}

export async function pasteFromHistory(): Promise<void> {
	const items = useClipboardHistory.getState().items;
	if (items.length === 0) {
		toast.info('Clipboard history is empty', 'Copies made in Anvil show up here.');
		return;
	}
	const picked = await quickPick({
		title: 'clipboard',
		placeholder: 'Search what you copied…',
		items: items.map((item, i) => ({
			id: String(i),
			label: clip(item.text, 90),
			description: item.source?.split('/').at(-1),
			detail: `${plural(item.text.split('\n').length, 'line')} · ${new Date(item.at).toLocaleTimeString()}`,
			keywords: [item.text.slice(0, 500)],
		})),
	});
	const entry = picked === null ? undefined : items[Number(picked)];
	if (!entry) return;
	const editor = focusedEditor();
	if (editor) {
		insertAtCursors(editor, entry.text);
		return;
	}
	await navigator.clipboard.writeText(entry.text);
	toast.info('Copied back to the clipboard', 'Paste it with Ctrl+V.');
}
