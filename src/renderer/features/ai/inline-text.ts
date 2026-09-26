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
