import type { ChatMessage } from './chat-store';

/** The file (and lines) a reply's code is about, taken from the question it answers. */
export interface ApplyTarget {
	path: string;
	/** 1-based inclusive lines, with the text that was on them when asked (empty if unknown). */
	selection: { startLine: number; endLine: number; text: string } | null;
}

/** The selection (preferred) or file attached to a question, if any. */
function questionTarget(m: ChatMessage): ApplyTarget | null {
	if (m.role !== 'user') return null;
	for (const c of m.context ?? []) {
		if (c.kind !== 'selection') continue;
		const lines = /^(.+):(\d+)-(\d+)$/.exec(c.label);
		if (lines?.[1])
			return {
				path: lines[1],
				selection: { startLine: Number(lines[2]), endLine: Number(lines[3]), text: c.text },
			};
	}
	const file = m.context?.find((c) => c.kind === 'file');
	return file ? { path: file.label, selection: null } : null;
}

/**
 * For each message, what a reply's code is about: the selection or file attached to its
 * question, or to the latest earlier question that had one (a follow-up like "now make it
 * async" attaches nothing new). Null for questions, and when no question named a file.
 */
export function replyTargets(messages: readonly ChatMessage[]): Array<ApplyTarget | null> {
	let last: ApplyTarget | null = null;
	return messages.map((m) => {
		last = questionTarget(m) ?? last;
		return m.role === 'assistant' ? last : null;
	});
}

/** Masked secrets as the Secret Shield writes them (see secret-filter.ts). */
const MASKED = /•{4,}/;

/** What to point out in an Apply preview before Accept. */
export function applyWarnings(p: {
	path: string;
	/** The file changed after the preview opened. */
	stale: boolean;
	original: string;
	block: string;
	wholeFile: boolean;
}): string[] {
	const out: string[] = [];
	if (p.stale)
		out.push(
			`${p.path} changed after this preview opened. Discard, then click Apply again to preview against the current file.`,
		);
	// The model only saw masked keys, so it may echo the dots back into its code.
	if (MASKED.test(p.block) && !MASKED.test(p.original))
		out.push(
			'The code contains masked secrets (••••). Accepting writes the dots over your real values.',
		);
	const fileLines = p.original.split('\n').length;
	const blockLines = p.block.split('\n').length;
	if (p.wholeFile && fileLines > 10 && blockLines < fileLines / 2)
		out.push(
			`This replaces all ${fileLines} lines of the file with a ${blockLines}-line block.`,
		);
	return out;
}

/**
 * Where the asked-about lines are in the file now. Edits since the question can move them, so
 * the question's text is looked up (the copy nearest the old lines wins). Null when that text
 * is gone. Context restored after a restart has no text: its lines are trusted as they are.
 */
export function locateSelection(
	file: string,
	selection: NonNullable<ApplyTarget['selection']>,
): { startLine: number; endLine: number } | null {
	const lineCount = file.split('\n').length;
	if (!selection.text) {
		return selection.endLine <= lineCount
			? { startLine: selection.startLine, endLine: selection.endLine }
			: null;
	}
	let best: number | null = null;
	for (
		let at = file.indexOf(selection.text);
		at !== -1;
		at = file.indexOf(selection.text, at + 1)
	) {
		const line = file.slice(0, at).split('\n').length;
		if (
			best === null ||
			Math.abs(line - selection.startLine) < Math.abs(best - selection.startLine)
		)
			best = line;
	}
	if (best === null) return null;
	const span = selection.text.replace(/\n$/, '').split('\n').length - 1;
	return { startLine: best, endLine: best + span };
}
