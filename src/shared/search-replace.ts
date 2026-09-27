/**
 * Find-and-replace across files, shared by main (files on disk) and the renderer (open
 * buffers with unsaved changes), so both apply exactly the same edit.
 *
 * Search runs in ripgrep (Rust regex syntax), replacement in JavaScript. The pattern is
 * converted where the dialects differ, and replacement works line by line, the way ripgrep
 * matches: a match never spans a line break.
 */

export interface ReplaceQuery {
	query: string;
	regex?: boolean | undefined;
	caseSensitive?: boolean | undefined;
	wholeWord?: boolean | undefined;
}

const POSIX_CLASSES: Record<string, string> = {
	alnum: 'a-zA-Z0-9',
	alpha: 'a-zA-Z',
	ascii: '\\x00-\\x7F',
	blank: ' \\t',
	cntrl: '\\x00-\\x1F\\x7F',
	digit: '0-9',
	graph: '!-~',
	lower: 'a-z',
	print: ' -~',
	punct: '!-\\/:-@\\[-`{-~',
	space: '\\s',
	upper: 'A-Z',
	word: '\\w',
	xdigit: '0-9A-Fa-f',
};

/**
 * Rust regex → JavaScript: named groups `(?P<n>…)`, `\A` / `\z` anchors and POSIX classes
 * like `[[:digit:]]`. Everything else the two share is left alone.
 */
export function rustToJsRegex(source: string): string {
	let out = '';
	let inClass = false;
	for (let i = 0; i < source.length; i++) {
		const c = source[i] ?? '';
		if (c === '\\') {
			const next = source[i + 1] ?? '';
			i++;
			if (!inClass && next === 'A') out += '^';
			else if (!inClass && (next === 'z' || next === 'Z')) out += '$';
			else out += `\\${next}`;
			continue;
		}
		if (inClass) {
			if (c === '[' && source[i + 1] === ':') {
				const end = source.indexOf(':]', i + 2);
				const cls = end === -1 ? undefined : POSIX_CLASSES[source.slice(i + 2, end)];
				if (cls !== undefined) {
					out += cls;
					i = end + 1;
					continue;
				}
			}
			if (c === ']') inClass = false;
			out += c;
			continue;
		}
		if (c === '[') {
			inClass = true;
			out += c;
			// A ']' right after '[' or '[^' is a literal, not the end of the class.
			if (source[i + 1] === '^') out += source[++i] ?? '';
			if (source[i + 1] === ']') out += source[++i] ?? '';
			continue;
		}
		if (source.startsWith('(?P<', i)) {
			out += '(?<';
			i += 3;
			continue;
		}
		out += c;
	}
	return out;
}

// Only syntax characters: Unicode mode rejects needless escapes such as "\-".
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** A global RegExp matching what ripgrep matched for this query (per line). */
export function buildReplaceRegex(q: ReplaceQuery): RegExp {
	let source = q.regex ? rustToJsRegex(q.query) : escapeRegExp(q.query);
	let flags = q.caseSensitive ? 'g' : 'gi';
	// A leading inline flag group, `(?i)` style, is Rust-only syntax.
	const inline = q.regex ? /^\(\?([imsxU]+)\)/.exec(source) : null;
	if (inline?.[1]) {
		source = source.slice(inline[0].length);
		if (inline[1].includes('i') && !flags.includes('i')) flags += 'i';
		if (inline[1].includes('s')) flags += 's';
	}
	const wrap = (word: string): string =>
		q.wholeWord ? `(?<!${word})(?:${source})(?!${word})` : source;
	try {
		// Unicode mode: ripgrep is Unicode-aware, so "whole word" must be too.
		return new RegExp(wrap('[\\p{L}\\p{N}_]'), `${flags}u`);
	} catch {
		// Some patterns valid in Rust (and in JS without /u) are rejected in Unicode mode,
		// e.g. escapes of characters that aren't special.
		return new RegExp(wrap('\\w'), flags);
	}
}

/**
 * The replacement for String.replace. Regex mode uses JavaScript semantics ($1, $<name>, $&,
 * $$) and also accepts Rust's ${1} / ${name}, plus \n and \t like VS Code. Literal mode
 * inserts the text as typed, so "$1" stays "$1".
 */
export function replacementFor(q: ReplaceQuery, replacement: string): string | (() => string) {
	if (!q.regex) return () => replacement;
	return replacement
		.replace(/\$\{(\d+)\}/g, '$$$1')
		.replace(/\$\{([A-Za-z_]\w*)\}/g, '$$<$1>')
		.replace(/\\(\\|n|t)/g, (_, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : '\\'));
}

export interface LineReplaceResult {
	text: string;
	/** Occurrences replaced. */
	count: number;
	/** Lines (1-based) that no longer match, i.e. the file changed since the search. */
	stale: number[];
}

/**
 * Replaces every match on the given 1-based lines only (the lines the user saw in the results).
 * Line endings are kept exactly as they were.
 */
export function replaceOnLines(
	text: string,
	lines: Iterable<number>,
	q: ReplaceQuery,
	replacement: string,
): LineReplaceResult {
	const re = buildReplaceRegex(q);
	const using = replacementFor(q, replacement);
	// [line, eol, line, eol, …, last line]
	const parts = text.split(/(\r\n|\n)/);
	let count = 0;
	const stale: number[] = [];
	for (const line of new Set(lines)) {
		const i = (line - 1) * 2;
		const current = parts[i];
		const n = current === undefined ? 0 : [...current.matchAll(re)].length;
		if (current === undefined || n === 0) {
			stale.push(line);
			continue;
		}
		// Two calls because TypeScript's replace() overloads don't accept the union.
		parts[i] =
			typeof using === 'string' ? current.replace(re, using) : current.replace(re, using);
		count += n;
	}
	return { text: parts.join(''), count, stale: stale.sort((a, b) => a - b) };
}
