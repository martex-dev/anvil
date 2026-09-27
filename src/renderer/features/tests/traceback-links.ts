/** A piece of traceback text: plain, or a reference to a file and line that can be opened. */
export type Segment = { text: string } | { text: string; path: string; line: number };

/**
 * pytest writes locations as `path:line: Error` at the start of a line (paths may contain spaces,
 * as in `C:\Users\PC Games\…`); Python's native style is `File "path", line N`. Both are found;
 * anything else stays text.
 */
const LINE_START = /^(\S[^:\r\n]*?\.pyw?|[A-Za-z]:[\\/][^:\r\n]*?\.pyw?):(\d+)(?=:|$)/;
const NATIVE = /File "([^"\r\n]+\.pyw?)", line (\d+)/g;

export function linkify(text: string): Segment[] {
	const out: Segment[] = [];
	const push = (segment: Segment): void => {
		const prev = out.at(-1);
		// Merge plain text so the result stays small.
		if (prev && !('path' in prev) && !('path' in segment)) prev.text += segment.text;
		else out.push(segment);
	};
	const lines = text.split(/(\r?\n)/);
	for (const line of lines) {
		const start = LINE_START.exec(line);
		if (start?.[1] && start[2]) {
			const ref = `${start[1]}:${start[2]}`;
			push({ text: ref, path: start[1], line: Number(start[2]) });
			push({ text: line.slice(ref.length) });
			continue;
		}
		let at = 0;
		for (const m of line.matchAll(NATIVE)) {
			const index = m.index;
			push({ text: line.slice(at, index) });
			push({ text: m[0], path: m[1] ?? '', line: Number(m[2]) });
			at = index + m[0].length;
		}
		push({ text: line.slice(at) });
	}
	return out.filter((s) => s.text !== '');
}

/**
 * A location as the workspace-relative path the editor opens, or null when it lies outside the
 * open folder (site-packages, the standard library): the editor only opens files in the folder.
 */
export function toWorkspaceFile(path: string, root: string | null): string | null {
	if (!root) return null;
	const norm = path.replace(/\\/g, '/');
	const absolute = /^[A-Za-z]:\//.test(norm) || norm.startsWith('/');
	if (!absolute) return norm.startsWith('../') ? null : norm.replace(/^\.\//, '');
	const base = `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/`;
	return norm.toLowerCase().startsWith(base.toLowerCase()) ? norm.slice(base.length) : null;
}
