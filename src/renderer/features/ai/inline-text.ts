import { splitFences } from './fences';

/**
 * The code in an inline-edit reply: its first fenced block, or the whole reply when it has no
 * fence. Only blank lines are trimmed from an unfenced reply, so the first line keeps its
 * indentation (an indented Python method would otherwise come back broken).
 */
export function extractCode(reply: string): string {
	const code = splitFences(reply).find((s) => s.kind === 'code');
	if (code && code.kind === 'code') return code.code;
	return reply.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/(?:\r?\n[ \t]*)+$/, '');
}

export function lineCount(text: string): number {
	return text ? text.split('\n').length : 0;
}

/** Same budget as a file context item (MAX_FILE), most of it before the cursor. */
const WINDOW = 200_000;
const BEFORE = 150_000;

/**
 * The file with a <CURSOR/> marker at `offset`, cut to a window around it for large files.
 * Cutting from the start instead could drop the marker the model is told to write at.
 */
export function withCursor(text: string, offset: number): string {
	const start = Math.max(0, Math.min(offset - BEFORE, text.length - WINDOW));
	const end = Math.min(text.length, start + WINDOW);
	const head = start > 0 ? '… (truncated)\n' : '';
	const tail = end < text.length ? '\n… (truncated)' : '';
	return `${head}${text.slice(start, offset)}<CURSOR/>${text.slice(offset, end)}${tail}`;
}
