/**
 * File references in terminal output that should open in the editor: Python tracebacks
 * (`File "C:\proj\a.py", line 12`), compiler/linter style `src/a.py:12:5`, and TypeScript's
 * `src/a.ts(12,5)`. Only files inside the open folder are linked.
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
const PATH = String.raw`((?:[A-Za-z]:[\\/]|\.{0,2}[\\/])?(?:[\w.@-]+[\\/])*[\w.@-]+\.[A-Za-z0-9]{1,8})`;
const COLON_STYLE = new RegExp(String.raw`${PATH}:(\d+)(?::(\d+))?`, 'g');
const PAREN_STYLE = new RegExp(String.raw`${PATH}\((\d+),(\d+)\)`, 'g');

/** Workspace-relative form of a path from terminal output, or null if it's outside. */
export function toRelative(raw: string, root: string): string | null {
	const p = raw.replace(/\\/g, '/');
	const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
	if (/^[A-Za-z]:\//.test(p) || p.startsWith('/')) {
		const prefix = `${r.toLowerCase()}/`;
		return p.toLowerCase().startsWith(prefix) ? p.slice(prefix.length) : null;
	}
	const rel = p.replace(/^\.\//, '');
	return rel.startsWith('../') ? null : rel;
}

export function findFileLinks(text: string, root: string): FileLink[] {
	const out: FileLink[] = [];
	const taken: Array<[number, number]> = [];
	const add = (start: number, end: number, raw: string, line: string, column?: string): void => {
		if (taken.some(([a, b]) => start < b && end > a)) return;
		const path = toRelative(raw, root);
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
