/**
 * Line-ending plumbing shared by every transform. Transforms work on a "body" (the text without
 * its final newline) so the selection's trailing newline and CRLF/LF style survive untouched.
 */

export type Eol = '\r\n' | '\n';

export function detectEol(text: string): Eol {
	return text.includes('\r\n') ? '\r\n' : '\n';
}

/** Runs `fn` on the text minus one trailing newline, then puts that newline back. */
export function mapBody(text: string, fn: (body: string, eol: Eol) => string): string {
	const eol = detectEol(text);
	let body = text;
	let tail = '';
	if (text.endsWith('\r\n')) {
		body = text.slice(0, -2);
		tail = '\r\n';
	} else if (text.endsWith('\n')) {
		body = text.slice(0, -1);
		tail = '\n';
	}
	return fn(body, eol) + tail;
}

/** Runs `fn` on the body's lines and rejoins them with the original line ending. */
export function mapLines(text: string, fn: (lines: string[]) => string[]): string {
	return mapBody(text, (body, eol) => fn(body.split(/\r?\n/)).join(eol));
}

export function perLine(fn: (line: string) => string): (text: string) => string {
	return (text) => mapLines(text, (lines) => lines.map(fn));
}

export function leadingWhitespace(line: string): string {
	return /^\s*/.exec(line)?.[0] ?? '';
}

/**
 * Applies `fn` to a line's content while keeping its indentation and trailing whitespace, so a
 * case change on an indented block doesn't flatten it. Blank lines pass through.
 */
export function onContent(fn: (content: string) => string): (line: string) => string {
	return (line) => {
		const trimmed = line.trim();
		if (trimmed === '') return line;
		const start = line.indexOf(trimmed);
		return line.slice(0, start) + fn(trimmed) + line.slice(start + trimmed.length);
	};
}

export function isBlank(line: string): boolean {
	return line.trim() === '';
}
