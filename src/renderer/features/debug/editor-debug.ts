import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../lib/monaco/setup';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { shiftLine } from '../editor/extras/bookmarks';
import { type Breakpoint, placeKey, useBreakpoints } from './breakpoints';
import { useDebugStore } from './debug-store';
import { workspacePathOf } from './session';

import './debug.css';

const CELL_MARKER = /^\s*#\s*%%/;

function glyphClass(b: Breakpoint, rejected: boolean): string {
	if (!b.enabled) return 'anvil-bp anvil-bp-disabled';
	if (rejected) return 'anvil-bp anvil-bp-unverified';
	if (b.logMessage) return 'anvil-bp anvil-bp-log';
	if (b.condition || b.hitCondition) return 'anvil-bp anvil-bp-conditional';
	return 'anvil-bp';
}

function hoverText(b: Breakpoint, rejected: boolean): string {
	if (rejected) return 'Breakpoint (no code on this line, the debugger cannot stop here)';
	const parts = [b.logMessage ? `Logpoint: \`${b.logMessage}\`` : 'Breakpoint'];
	if (b.condition) parts.push(`when \`${b.condition}\``);
	if (b.hitCondition) parts.push(`hit count \`${b.hitCondition}\``);
	if (!b.enabled) parts.push('(disabled)');
	return parts.join(' ');
}

/** A model's last change already applied to the store (two groups may show one file). */
const shiftedVersion = new WeakMap<Monaco.editor.ITextModel, number>();

/**
 * Debugger marks on one editor: breakpoints in the glyph margin (a click toggles one, and they
 * follow edits like bookmarks do), a faint dot under the mouse, and the line the program is
 * paused on.
 */
export function attachDebugger(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	const marks = editor.createDecorationsCollection();
	const paused = editor.createDecorationsCollection();
	const hint = editor.createDecorationsCollection();
	const pathOf = (): string | null => {
		const model = editor.getModel();
		return model && model.getLanguageId() === 'python' ? toWorkspacePath(model.uri) : null;
	};
	const glyph = (
		line: number,
		className: string,
		hover?: string,
	): Monaco.editor.IModelDeltaDecoration => ({
		range: new monaco.Range(line, 1, line, 1),
		options: {
			stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
			// The cells' run arrow lives in the left lane too; Monaco widens the margin when both
			// land on a `# %%` line instead of drawing one over the other.
			glyphMargin: { position: monaco.editor.GlyphMarginLane.Left },
			glyphMarginClassName: className,
			...(hover ? { glyphMarginHoverMessage: { value: hover } } : {}),
		},
	});

	const paintBreakpoints = (): void => {
		const model = editor.getModel();
		const path = pathOf();
		if (!model || !path) return marks.clear();
		const { items, rejected } = useBreakpoints.getState();
		marks.set(
			items
				.filter((b) => b.path === path && b.line <= model.getLineCount())
				.map((b) => {
					const off = rejected.has(placeKey(b.path, b.line));
					return glyph(b.line, glyphClass(b, off), hoverText(b, off));
				}),
		);
	};

	const paintPaused = (): void => {
		const model = editor.getModel();
		const path = pathOf();
		const { frames, frameId } = useDebugStore.getState();
		const frame = frames.find((f) => f.id === frameId);
		const framePath = frame?.source?.path ? workspacePathOf(frame.source.path) : null;
		if (!model || !path || !frame || framePath !== path || frame.line > model.getLineCount())
			return paused.clear();
		// The top frame is where the program is; a frame picked further down the stack is only
		// where that call came from, so it gets the quieter look.
		const top = frames[0]?.id === frame.id;
		paused.set([
			{
				range: new monaco.Range(frame.line, 1, frame.line, 1),
				options: {
					isWholeLine: true,
					className: top ? 'anvil-debug-line' : 'anvil-debug-line anvil-debug-caller',
					// Its own lane: on a breakpoint's line both the dot and the arrow stay visible.
					glyphMargin: { position: monaco.editor.GlyphMarginLane.Center },
					glyphMarginClassName: top
						? 'anvil-debug-pointer'
						: 'anvil-debug-pointer anvil-debug-caller',
					stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
				},
			},
		]);
	};

	const glyphLine = (e: Monaco.editor.IEditorMouseEvent): number | null => {
		if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return null;
		const line = e.target.position?.lineNumber;
		const model = editor.getModel();
		if (!line || !model || !pathOf()) return null;
		// A `# %%` line's glyph runs the cell (cells.ts).
		return CELL_MARKER.test(model.getLineContent(line)) ? null : line;
	};

	const follow = (e: Monaco.editor.IModelContentChangedEvent): void => {
		const model = editor.getModel();
		const path = pathOf();
		if (!model || !path || !useBreakpoints.getState().items.some((b) => b.path === path))
			return;
		if (shiftedVersion.get(model) === e.versionId) return;
		shiftedVersion.set(model, e.versionId);
		useBreakpoints.getState().relocate(path, (line) => shiftLine(line, e.changes));
	};

	const subs = [
		editor.onDidChangeModel(() => {
			hint.clear();
			paintBreakpoints();
			paintPaused();
		}),
		editor.onDidChangeModelLanguage(() => {
			paintBreakpoints();
			paintPaused();
		}),
		editor.onDidChangeModelContent(follow),
		editor.onMouseDown((e) => {
			const { leftButton, ctrlKey, shiftKey, altKey, metaKey } = e.event;
			if (!leftButton || ctrlKey || shiftKey || altKey || metaKey) return;
			const line = glyphLine(e);
			const path = pathOf();
			if (line && path) useBreakpoints.getState().toggle(path, line);
		}),
		editor.onMouseMove((e) => {
			const line = glyphLine(e);
			const path = pathOf();
			const taken = useBreakpoints
				.getState()
				.items.some((b) => b.path === path && b.line === line);
			if (!line || taken) return hint.clear();
			hint.set([glyph(line, 'anvil-bp anvil-bp-hint')]);
		}),
		editor.onMouseLeave(() => hint.clear()),
	];
	const offBreakpoints = useBreakpoints.subscribe(paintBreakpoints);
	const offPaused = useDebugStore.subscribe((s, prev) => {
		if (s.frames !== prev.frames || s.frameId !== prev.frameId) paintPaused();
	});
	paintBreakpoints();
	paintPaused();
	return {
		dispose() {
			offBreakpoints();
			offPaused();
			for (const s of subs) s.dispose();
			marks.clear();
			paused.clear();
			hint.clear();
		},
	};
}
