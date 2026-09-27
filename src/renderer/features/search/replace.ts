import type { editor } from 'monaco-editor';

import type { ReplaceResult, SearchFile, SearchQuery } from '@shared/ipc/channels/search';
import { replaceOnLines } from '@shared/search-replace';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { getModel } from '../editor/buffers';

/** One file's share of a replace: the lines the user saw matches on. */
export interface ReplaceTarget {
	path: string;
	lines: number[];
	/** When the search saw the file; main skips it if it changed since. */
	mtimeMs?: number | undefined;
}

export const CHANGED = 'changed since the search';

/** Every listed line of these result files (or just `line` of one file). */
export function targetsFor(files: readonly SearchFile[], line?: number): ReplaceTarget[] {
	return files.map((f) => ({
		path: f.path,
		lines: line === undefined ? [...new Set(f.matches.map((m) => m.line))] : [line],
		...(f.mtimeMs === undefined ? {} : { mtimeMs: f.mtimeMs }),
	}));
}

/**
 * Replaces in an open buffer rather than on disk: the edit lands in the editor, stays unsaved
 * and undoes in one step (Ctrl+Z), and unsaved changes in that buffer aren't overwritten by a
 * disk write. Lines are the search's line numbers; a line that no longer matches (the buffer
 * was edited since) is left alone and counted as stale.
 */
export function replaceInModel(
	model: editor.ITextModel,
	lines: readonly number[],
	query: SearchQuery,
	replacement: string,
): { count: number; stale: number } {
	const edits: editor.IIdentifiedSingleEditOperation[] = [];
	let count = 0;
	let stale = 0;
	for (const line of new Set(lines)) {
		if (line > model.getLineCount()) {
			stale++;
			continue;
		}
		const text = model.getLineContent(line);
		const r = replaceOnLines(text, [1], query, replacement);
		if (r.stale.length > 0) {
			stale++;
			continue;
		}
		count += r.count;
		edits.push({
			range: {
				startLineNumber: line,
				startColumn: 1,
				endLineNumber: line,
				endColumn: model.getLineMaxColumn(line),
			},
			text: r.text,
		});
	}
	if (edits.length > 0) {
		// Stack elements around the edit make it one undo step of its own.
		model.pushStackElement();
		model.pushEditOperations([], edits, () => null);
		model.pushStackElement();
	}
	return { count, stale };
}

/**
 * Replaces across files: open buffers through their Monaco model, everything else on disk in
 * main. Resolves with what happened; failures of the whole request reject.
 */
export async function replaceAcross(
	query: SearchQuery,
	replacement: string,
	targets: readonly ReplaceTarget[],
): Promise<ReplaceResult> {
	const result: ReplaceResult = { replaced: 0, files: [], skipped: [] };
	const onDisk: ReplaceTarget[] = [];
	for (const target of targets) {
		const model = getModel(target.path);
		if (!model) {
			onDisk.push(target);
			continue;
		}
		const r = replaceInModel(model, target.lines, query, replacement);
		if (r.count > 0) {
			result.replaced += r.count;
			result.files.push(target.path);
		}
		if (r.stale > 0) result.skipped.push({ path: target.path, reason: CHANGED });
	}
	if (onDisk.length > 0) {
		const disk = await call('search:replace', { query, replacement, files: onDisk });
		result.replaced += disk.replaced;
		result.files.push(...disk.files);
		result.skipped.push(...disk.skipped);
	}
	return result;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Toasts the outcome: what was replaced, and which files were left alone and why. */
export function reportReplace(result: ReplaceResult): void {
	if (result.replaced > 0)
		toast.success(
			'Replaced',
			`${plural(result.replaced, 'occurrence')} in ${plural(result.files.length, 'file')}`,
		);
	if (result.skipped.length === 0) {
		if (result.replaced === 0) toast.info('Nothing replaced', 'No match was left to replace.');
		return;
	}
	const first = result.skipped
		.slice(0, 3)
		.map((s) => `${s.path}: ${s.reason}`)
		.join('\n');
	const more = result.skipped.length > 3 ? `\n…and ${result.skipped.length - 3} more` : '';
	toast.warn(
		`${plural(result.skipped.length, 'file')} not changed`,
		`${first}${more}\nSearch again to see the current matches.`,
	);
}
