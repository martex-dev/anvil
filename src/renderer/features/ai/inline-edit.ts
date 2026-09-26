import type * as Monaco from 'monaco-editor';
import { create } from 'zustand';

import type { AiContext } from '@shared/ipc/channels/ai';

import { getLoadedMonaco } from '../../lib/monaco/load';
import { toast } from '../../stores/toast-store';
import { activeEditor, fileContext, problemsContext } from './editor-context';
import { splitFences } from './fences';
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
	/** Range being replaced (whole lines), or an empty range for "insert here". */
	range: Monaco.IRange;
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

function teardown(): void {
	if (!session) return;
	const s = session;
	session = null;
	s.abort?.abort();
	for (const d of s.disposables) d.dispose();
	s.decorations.clear();
	s.editor.changeViewZones((a) => {
		if (s.zoneId) a.removeZone(s.zoneId);
	});
	s.editor.removeOverlayWidget(s.widget);
	useInlineEdit.setState({
		phase: null,
		host: null,
		partial: '',
		error: null,
		stats: null,
		preset: '',
	});
	s.editor.focus();
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
	const layout = editor.getLayoutInfo();
	Object.assign(host.style, {
		position: 'absolute',
		left: `${layout.contentLeft}px`,
		width: `${Math.max(320, Math.min(760, layout.contentWidth - layout.verticalScrollbarWidth - 24))}px`,
		zIndex: '20',
	});
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
	session = {
		editor,
		model,
		range,
		original: model.getValueInRange(range),
		zoneId,
		widget,
		decorations,
		applied: null,
		abort: null,
		disposables: [],
		ownEdit: false,
	};
	session.disposables.push(
		editor.onDidChangeModel(() => teardown()),
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

function extractCode(reply: string): string {
	const code = splitFences(reply).find((s) => s.kind === 'code');
	return code && code.kind === 'code' ? code.code : reply.trim();
}

function lineCount(text: string): number {
	return text ? text.split('\n').length : 0;
}

export async function submitInlineEdit(instruction: string): Promise<void> {
	const s = session;
	if (!s || !instruction.trim()) return;
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
			const text = s.model.getValue();
			file.text = `${text.slice(0, offset)}<CURSOR/>${text.slice(offset)}`.slice(0, 200_000);
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
		if (!insert && s.original.endsWith('\n') === false && code.endsWith('\n'))
			code = code.replace(/\n+$/, '');
		s.ownEdit = true;
		s.model.pushStackElement();
		s.model.pushEditOperations([], [{ range: s.range, text: code }], () => null);
		s.model.pushStackElement();
		s.ownEdit = false;
		const endLine = s.range.startLineNumber + Math.max(0, lineCount(code) - 1);
		s.applied = {
			startLineNumber: s.range.startLineNumber,
			startColumn: insert ? s.range.startColumn : 1,
			endLineNumber: endLine,
			endColumn: s.model.getLineMaxColumn(endLine),
		};
		s.decorations.set([
			{ range: s.applied, options: { isWholeLine: true, className: 'anvil-ai-added' } },
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
		s.model.pushEditOperations([], [{ range: s.applied, text: s.original }], () => null);
		s.ownEdit = false;
	}
	teardown();
}

export function cancelInlineEdit(): void {
	if (useInlineEdit.getState().phase === 'review') rejectInlineEdit();
	else teardown();
}
