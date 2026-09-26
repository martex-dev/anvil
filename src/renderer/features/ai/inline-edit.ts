import type * as Monaco from 'monaco-editor';
import { create } from 'zustand';

import type { AiContext } from '@shared/ipc/channels/ai';

import { getLoadedMonaco } from '../../lib/monaco/load';
import { toast } from '../../stores/toast-store';
import { activeEditor, fileContext, problemsContext } from './editor-context';
import { bindInlineEditKeys } from './inline-edit-keys';
import { appliedRange, currentRange, trackRange } from './inline-range';
import { extractCode, lineCount, withCursor } from './inline-text';
import { streamOnce } from './requests';

export type InlinePhase = 'prompt' | 'generating' | 'review';

interface InlineState {
	phase: InlinePhase | null;
	/** Where the React box is portalled (a Monaco overlay widget node). */
	host: HTMLElement | null;
	path: string;
	/** Instruction prefilled by one-click actions (docstring, vectorize…). */
	preset: string;
	partial: string;
	error: string | null;
	stats: { added: number; removed: number } | null;
}

export const useInlineEdit = create<InlineState>(() => ({
	phase: null,
	host: null,
	path: '',
	preset: '',
	partial: '',
	error: null,
	stats: null,
}));

interface Session {
	editor: Monaco.editor.IStandaloneCodeEditor;
	model: Monaco.editor.ITextModel;
	/**
	 * Range being replaced (whole lines), or an empty range for "insert here". Re-read from
	 * `tracker` before use, since the file can change while the box is open.
	 */
	range: Monaco.IRange;
	tracker: Monaco.editor.IEditorDecorationsCollection;
	original: string;
	zoneId: string | null;
	widget: Monaco.editor.IOverlayWidget;
	decorations: Monaco.editor.IEditorDecorationsCollection;
	applied: Monaco.IRange | null;
	abort: AbortController | null;
	disposables: Monaco.IDisposable[];
	ownEdit: boolean;
}

let session: Session | null = null;

const ZONE_HEIGHT = 56;

/** `editorGone`: the editor was disposed, so only state and the request are cleaned up. */
function teardown(editorGone = false): void {
	if (!session) return;
	const s = session;
	session = null;
	s.abort?.abort();
	for (const d of s.disposables) d.dispose();
	useInlineEdit.setState({
		phase: null,
		host: null,
		partial: '',
		error: null,
		stats: null,
		preset: '',
	});
	if (editorGone) return;
	s.decorations.clear();
	s.tracker.clear();
	s.editor.changeViewZones((a) => {
		if (s.zoneId) a.removeZone(s.zoneId);
	});
	s.editor.removeOverlayWidget(s.widget);
	s.editor.focus();
}

/** Sizes the box to the code area; re-run on layout changes (side bar, split, AI pane). */
function fitHost(host: HTMLElement, layout: Monaco.editor.EditorLayoutInfo): void {
	host.style.left = `${layout.contentLeft}px`;
	host.style.width = `${Math.max(320, Math.min(760, layout.contentWidth - layout.verticalScrollbarWidth - 24))}px`;
}

/** Opens the Ctrl+I box over the selection (whole lines) or at the cursor. */
export function startInlineEdit(preset = ''): void {
	const ctx = activeEditor();
	if (!ctx) {
		toast.info('Open a file to edit it with AI');
		return;
	}
	teardown();
	const { editor, model } = ctx;
	const sel = editor.getSelection();
	if (!sel) return;
	const range: Monaco.IRange = sel.isEmpty()
		? {
				startLineNumber: sel.startLineNumber,
				startColumn: sel.startColumn,
				endLineNumber: sel.startLineNumber,
				endColumn: sel.startColumn,
			}
		: {
				startLineNumber: sel.startLineNumber,
				startColumn: 1,
				endLineNumber: ctx.selection?.endLine ?? sel.endLineNumber,
				endColumn: model.getLineMaxColumn(ctx.selection?.endLine ?? sel.endLineNumber),
			};
	const host = document.createElement('div');
	host.className = 'anvil-inline-host';
	const widget: Monaco.editor.IOverlayWidget = {
		getId: () => 'anvil.inlineEdit',
		getDomNode: () => host,
		getPosition: () => null,
	};
	Object.assign(host.style, { position: 'absolute', zIndex: '20' });
	fitHost(host, editor.getLayoutInfo());
	editor.addOverlayWidget(widget);
	let zoneId: string | null = null;
	editor.changeViewZones((a) => {
		zoneId = a.addZone({
			afterLineNumber: range.startLineNumber - 1,
			heightInPx: ZONE_HEIGHT,
			domNode: document.createElement('div'),
			onDomNodeTop: (top) => {
				host.style.top = `${top}px`;
			},
		});
	});
	const decorations = editor.createDecorationsCollection(
		sel.isEmpty()
			? []
			: [{ range, options: { isWholeLine: true, className: 'anvil-ai-range' } }],
	);
	const monaco = getLoadedMonaco();
	session = {
		editor,
		model,
		range,
		tracker: trackRange(monaco, editor, range),
		original: model.getValueInRange(range),
		zoneId,
		widget,
		decorations,
		applied: null,
		abort: null,
		disposables: [],
		ownEdit: false,
	};
	if (monaco) {
		const keys = bindInlineEditKeys(monaco, editor, {
			cancel: cancelInlineEdit,
			accept: acceptInlineEdit,
		});
		const unsubscribe = useInlineEdit.subscribe((st) => keys.setReview(st.phase === 'review'));
		session.disposables.push({ dispose: unsubscribe }, keys);
	}
	session.disposables.push(
		editor.onDidChangeModel(() => teardown()),
		editor.onDidLayoutChange((info) => fitHost(host, info)),
		// Closing the split must stop the request too, or it keeps spending tokens.
		editor.onDidDispose(() => teardown(true)),
		model.onWillDispose(() => teardown()),
		model.onDidChangeContent(() => {
			// Typing elsewhere while reviewing means "keep it".
			if (session && !session.ownEdit && useInlineEdit.getState().phase === 'review')
				acceptInlineEdit();
		}),
	);
	editor.revealLineInCenterIfOutsideViewport(range.startLineNumber);
	useInlineEdit.setState({
		phase: 'prompt',
		host,
		path: ctx.path,
		preset,
		partial: '',
		error: null,
		stats: null,
	});
}

/** Moves the session onto where its code is now; false (error shown) if it was deleted. */
function refreshRange(s: Session): boolean {
	const range = currentRange(s.tracker, s.model, s.range);
	if (!range) {
		useInlineEdit.setState({
			phase: 'prompt',
			error: 'The code to edit was deleted. Press Esc and select it again.',
		});
		return false;
	}
	s.range = range;
	s.original = s.model.getValueInRange(range);
	return true;
}

export async function submitInlineEdit(instruction: string): Promise<void> {
	const s = session;
	if (!s || !instruction.trim() || !refreshRange(s)) return;
	const monaco = getLoadedMonaco();
	const ctx = activeEditor();
	const insert =
		s.range.startLineNumber === s.range.endLineNumber &&
		s.range.startColumn === s.range.endColumn;
	const path = useInlineEdit.getState().path;
	const context: AiContext[] = [];
	if (ctx) {
		const file = fileContext(ctx);
		if (insert) {
			const offset = s.model.getOffsetAt({
				lineNumber: s.range.startLineNumber,
				column: s.range.startColumn,
			});
			file.text = withCursor(s.model.getValue(), offset);
		}
		context.push(file);
		const problems = monaco
			? problemsContext(monaco, ctx, {
					start: s.range.startLineNumber,
					end: s.range.endLineNumber,
				})
			: null;
		if (problems) context.push(problems);
	}
	if (!insert)
		context.push({
			kind: 'selection',
			label: `${path}:${s.range.startLineNumber}-${s.range.endLineNumber}`,
			language: s.model.getLanguageId(),
			text: s.original,
		});
	s.abort = new AbortController();
	useInlineEdit.setState({ phase: 'generating', partial: '', error: null });
	try {
		const reply = await streamOnce({
			mode: 'edit',
			messages: [
				{
					role: 'user',
					content: insert
						? `${instruction}\n\nWrite the code to insert at <CURSOR/> in ${path}.`
						: instruction,
				},
			],
			context,
			signal: s.abort.signal,
			onPartial: (text) => useInlineEdit.setState({ partial: text }),
		});
		if (session !== s) return;
		let code = extractCode(reply);
		// A refusal or empty reply would otherwise replace the selection with nothing.
		if (!code.trim()) {
			useInlineEdit.setState({
				phase: 'prompt',
				error: 'The model returned no code. Try rephrasing the instruction.',
			});
			return;
		}
		// Edits made while it generated moved the code: replace it where it is now.
		if (!refreshRange(s)) return;
		if (!insert && s.original.endsWith('\n') === false && code.endsWith('\n'))
			code = code.replace(/\n+$/, '');
		s.ownEdit = true;
		s.model.pushStackElement();
		s.model.pushEditOperations([], [{ range: s.range, text: code }], () => null);
		s.model.pushStackElement();
		s.ownEdit = false;
		s.applied = appliedRange(s.range, code, insert, s.model);
		s.decorations.set([
			{ range: s.applied, options: { isWholeLine: !insert, className: 'anvil-ai-added' } },
		]);
		useInlineEdit.setState({
			phase: 'review',
			stats: { added: lineCount(code), removed: insert ? 0 : lineCount(s.original) },
		});
	} catch (error) {
		if (session !== s) return;
		const message = error instanceof Error ? error.message : String(error);
		useInlineEdit.setState({
			phase: 'prompt',
			error: message === 'Cancelled' ? null : message,
		});
	}
}

export function acceptInlineEdit(): void {
	teardown();
}

export function rejectInlineEdit(): void {
	const s = session;
	if (s?.applied) {
		s.ownEdit = true;
		// Its own undo step, so Ctrl+Z after Reject doesn't bring the rejected code back.
		s.model.pushStackElement();
		s.model.pushEditOperations([], [{ range: s.applied, text: s.original }], () => null);
		s.model.pushStackElement();
		s.ownEdit = false;
	}
	teardown();
}

export function cancelInlineEdit(): void {
	if (useInlineEdit.getState().phase === 'review') rejectInlineEdit();
	else teardown();
}
