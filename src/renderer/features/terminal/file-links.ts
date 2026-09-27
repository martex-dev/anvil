/**
 * File references in terminal output that should open in the editor: Python tracebacks
 * (`File "C:\proj\a.py", line 12`), compiler/linter style `src/a.py:12:5`, and TypeScript's
 * `src/a.ts(12,5)`. Only files inside the open folder are candidates; the link provider still
 * checks that each one exists, which keeps `example.com:443` or `np.mean:3` plain text.
 */
export interface FileLink {
	/** 0-based [start, end) in the line text. */
	start: number;
	end: number;
	/** Workspace-relative, '/'-separated. */
	path: string;
	line: number;
	column: number;
}

const PY_TRACEBACK = /File "([^"]+)", line (\d+)/g;
// A file extension starts with a letter: `0.0.0.0:8000` and `127.0.0.1:5000` are addresses.
const EXT = String.raw`\.[A-Za-z][A-Za-z0-9]{0,7}`;
// Absolute Windows paths may contain spaces (C:\Users\John Smith\...), so they allow anything
// a file name can hold, stopping at the first extension that the line/column suffix follows.
const DRIVE_PATH = String.raw`(?<!\w)[A-Za-z]:[\\/][^:*?"<>|\r\n]*?${EXT}`;
// Relative paths can't contain spaces, and never start mid-token (inside a longer path).
const REL_PATH = String.raw`(?<![\w.@\\/:-])(?:\.{0,2}[\\/])?(?:[\w.@-]+[\\/])*[\w.@-]+${EXT}`;
const PATH = `(${DRIVE_PATH}|${REL_PATH})`;
const COLON_STYLE = new RegExp(String.raw`${PATH}:(\d+)(?::(\d+))?`, 'g');
const PAREN_STYLE = new RegExp(String.raw`${PATH}\((\d+),(\d+)\)`, 'g');

/** Joins path segments, resolving `.` and `..`; null when they climb above the start. */
function normalise(parts: readonly string[]): string | null {
	const out: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part !== '..') out.push(part);
		else if (out.pop() === undefined) return null;
	}
	return out.length > 0 ? out.join('/') : null;
}

/**
 * Workspace-relative form of a path from terminal output, or null if it's outside. Relative
 * paths are taken from `cwd`, the folder the terminal started in ('' is the workspace root).
 */
export function toRelative(raw: string, root: string, cwd = ''): string | null {
	const p = raw.replace(/\\/g, '/');
	const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
	if (/^[A-Za-z]:\//.test(p) || p.startsWith('/')) {
		const prefix = `${r.toLowerCase()}/`;
		return p.toLowerCase().startsWith(prefix)
			? normalise(p.slice(prefix.length).split('/'))
			: null;
	}
	return normalise([...cwd.split('/'), ...p.split('/')]);
}

export function findFileLinks(text: string, root: string, cwd = ''): FileLink[] {
	const out: FileLink[] = [];
	const taken: Array<[number, number]> = [];
	const add = (start: number, end: number, raw: string, line: string, column?: string): void => {
		if (taken.some(([a, b]) => start < b && end > a)) return;
		const path = toRelative(raw, root, cwd);
		if (!path) return;
		taken.push([start, end]);
		out.push({ start, end, path, line: Number(line), column: column ? Number(column) : 1 });
	};
	for (const m of text.matchAll(PY_TRACEBACK)) {
		if (m.index !== undefined && m[1] && m[2])
			add(m.index + 5, m.index + m[0].length, m[1], m[2]);
	}
	for (const re of [PAREN_STYLE, COLON_STYLE]) {
		for (const m of text.matchAll(re)) {
			if (m.index !== undefined && m[1] && m[2])
				add(m.index, m.index + m[0].length, m[1], m[2], m[3]);
		}
	}
	return out.sort((a, b) => a.start - b.start);
}
