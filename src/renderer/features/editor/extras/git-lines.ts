import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../../app/hooks/use-settings';
import { escapeMarkdown } from '../../../lib/escape-markdown';
import { call } from '../../../lib/ipc';
import { diffLines } from '../../../lib/line-diff';
import type { MonacoApi } from '../../../lib/monaco/setup';
import { toWorkspacePath } from '../../../lib/monaco/workspace-root';
import { resolveToken } from '../../../lib/resolve-color';
import { useEditorStore } from '../editor-store';

function relTime(ms: number): string {
	const s = Math.max(0, (Date.now() - ms) / 1000);
	const units: Array<[number, string]> = [
		[31_536_000, 'year'],
		[2_592_000, 'month'],
		[604_800, 'week'],
		[86_400, 'day'],
		[3_600, 'hour'],
		[60, 'minute'],
	];
	for (const [size, name] of units) {
		const n = Math.floor(s / size);
		if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
	}
	return 'just now';
}

/** HEAD versions per file, refreshed when git state changes (commit, checkout, pull). */
const headCache = new Map<string, Promise<string | null>>();
export function invalidateGitLines(): void {
	headCache.clear();
	window.dispatchEvent(new CustomEvent('anvil:git-lines'));
}
function headOf(path: string): Promise<string | null> {
	let hit = headCache.get(path);
	if (!hit) {
		hit = call('git:headContent', path)
			.then((r) => r.content)
			.catch(() => null);
		headCache.set(path, hit);
	}
	return hit;
}

/**
 * Git in the editor itself: colored gutter bars for lines added / changed / removed since HEAD,
 * and a quiet "author, time • message" after the line you're on.
 */
export function attachGitLines(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	const gutter = editor.createDecorationsCollection();
	const blame = editor.createDecorationsCollection();
	let gutterTimer: ReturnType<typeof setTimeout> | null = null;
	let blameTimer: ReturnType<typeof setTimeout> | null = null;
	let generation = 0;

	const pathOf = (model: Monaco.editor.ITextModel): string | null => toWorkspacePath(model.uri);

	const paintGutter = async (): Promise<void> => {
		const model = editor.getModel();
		const path = model ? pathOf(model) : null;
		const mine = ++generation;
		if (!model || !path) return gutter.clear();
		const head = await headOf(path);
		if (mine !== generation || editor.getModel() !== model) return;
		if (head === null) return gutter.clear();
		const changes = diffLines(head, model.getValue());
		if (!changes) return gutter.clear();
		const ruler = {
			added: resolveToken('--up'),
			modified: resolveToken('--info'),
			deleted: resolveToken('--down'),
		};
		gutter.set(
			changes.map((c) => {
				const deleted = c.kind === 'deleted';
				const line = deleted ? Math.max(1, c.start - 1) : c.start;
				return {
					range: new monaco.Range(line, 1, deleted ? line : c.end, 1),
					options: {
						isWholeLine: true,
						linesDecorationsClassName: `anvil-diff-${c.kind}`,
						overviewRuler: {
							color: ruler[c.kind],
							position: monaco.editor.OverviewRulerLane.Left,
						},
					},
				};
			}),
		);
	};

	const paintBlame = async (): Promise<void> => {
		blame.clear();
		const model = editor.getModel();
		const pos = editor.getPosition();
		const path = model ? pathOf(model) : null;
		if (!getSettings().inlineBlame || !model || !pos || !path) return;
		// A dirty buffer's line numbers no longer match what git blames.
		if (useEditorStore.getState().files.find((f) => f.path === path)?.dirty) return;
		const line = pos.lineNumber;
		const info = await call('git:blame', { path, line }).catch(() => null);
		if (!info || editor.getModel() !== model || editor.getPosition()?.lineNumber !== line)
			return;
		const text = `    ${info.author}, ${relTime(info.date)} • ${info.summary}`.slice(0, 160);
		blame.set([
			{
				range: new monaco.Range(
					line,
					model.getLineMaxColumn(line),
					line,
					model.getLineMaxColumn(line),
				),
				options: {
					// Empty range at the end of the line: Monaco drops injected text without this.
					showIfCollapsed: true,
					after: { content: text, inlineClassName: 'anvil-blame-text' },
					hoverMessage: {
						value: `**${info.hash.slice(0, 8)}** ${escapeMarkdown(info.author)}\n\n${escapeMarkdown(info.summary)}`,
					},
				},
			},
		]);
	};

	const scheduleGutter = (): void => {
		if (gutterTimer) clearTimeout(gutterTimer);
		gutterTimer = setTimeout(() => void paintGutter(), 300);
	};
	const scheduleBlame = (): void => {
		blame.clear();
		if (blameTimer) clearTimeout(blameTimer);
		blameTimer = setTimeout(() => void paintBlame(), 500);
	};
	const refresh = (): void => {
		void paintGutter();
		scheduleBlame();
	};

	const subs = [
		editor.onDidChangeModel(refresh),
		editor.onDidChangeModelContent(() => {
			scheduleGutter();
			blame.clear();
		}),
		editor.onDidChangeCursorPosition(scheduleBlame),
	];
	window.addEventListener('anvil:git-lines', refresh);
	// Fired after every settings change: Toggle Inline Blame, or the switch in Settings.
	window.addEventListener('anvil:appearance', scheduleBlame);
	refresh();
	return {
		dispose() {
			window.removeEventListener('anvil:git-lines', refresh);
			window.removeEventListener('anvil:appearance', scheduleBlame);
			if (gutterTimer) clearTimeout(gutterTimer);
			if (blameTimer) clearTimeout(blameTimer);
			for (const s of subs) s.dispose();
			gutter.clear();
			blame.clear();
		},
	};
}
