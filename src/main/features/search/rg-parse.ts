import type { SearchFile, SearchMatch } from '@shared/ipc/channels/search';

// Very long lines (minified bundles) are cut to a window around the first match.
const MAX_LINE = 400;
const CONTEXT_BEFORE = 60;

interface RgText {
	text?: string;
}
interface RgMatch {
	type: 'match';
	data: {
		path: RgText;
		lines: RgText;
		line_number: number;
		submatches: Array<{ start: number; end: number }>;
	};
}

/** ripgrep reports UTF-8 byte offsets; the UI needs UTF-16 string indices. */
function byteToIndex(text: string, byteOffset: number): number {
	return Buffer.from(text, 'utf8').subarray(0, byteOffset).toString('utf8').length;
}

/** One `rg --json` match event → a match, or null for binary/non-UTF-8 lines. */
export function parseMatch(event: RgMatch): { path: string; match: SearchMatch } | null {
	const { path, lines, line_number: line, submatches } = event.data;
	if (path.text === undefined || lines.text === undefined) return null;
	let text = lines.text.replace(/\r?\n$/, '');
	let ranges = submatches.map(
		(s) =>
			[byteToIndex(lines.text ?? '', s.start), byteToIndex(lines.text ?? '', s.end)] as [
				number,
				number,
			],
	);
	const first = ranges[0]?.[0] ?? 0;
	if (text.length > MAX_LINE) {
		const start = Math.max(0, first - CONTEXT_BEFORE);
		const prefix = start > 0 ? '…' : '';
		text = `${prefix}${text.slice(start, start + MAX_LINE)}`;
		const shift = prefix.length - start;
		ranges = ranges
			.map(([a, b]) => [a + shift, Math.min(b + shift, text.length)] as [number, number])
			.filter(([a, b]) => a >= 0 && a < b);
	}
	// Keep leading indentation out of the preview; results read better left-aligned.
	const indent = text.length - text.trimStart().length;
	if (indent > 0) {
		text = text.slice(indent);
		ranges = ranges.map(([a, b]) => [Math.max(0, a - indent), b - indent] as [number, number]);
	}
	return {
		path: path.text.replace(/\\/g, '/').replace(/^\.\//, ''),
		match: { line, column: first + 1, text: text.trimEnd(), ranges },
	};
}

/** Accumulates matches per file, in the order ripgrep reports them, up to `limit`. */
export class ResultCollector {
	private files = new Map<string, SearchFile>();
	count = 0;
	truncated = false;

	constructor(private readonly limit: number) {}

	/** Feed one line of `rg --json` output. Returns false once the limit is reached. */
	add(line: string): boolean {
		if (this.truncated) return false;
		let event: { type?: string };
		try {
			event = JSON.parse(line) as { type?: string };
		} catch {
			return true; // partial/garbled line: ignore
		}
		if (event.type !== 'match') return true;
		const parsed = parseMatch(event as RgMatch);
		if (!parsed) return true;
		let file = this.files.get(parsed.path);
		if (!file) {
			file = { path: parsed.path, matches: [] };
			this.files.set(parsed.path, file);
		}
		file.matches.push(parsed.match);
		this.count += parsed.match.ranges.length || 1;
		if (this.count >= this.limit) {
			this.truncated = true;
			return false;
		}
		return true;
	}

	result(): SearchFile[] {
		return [...this.files.values()];
	}
}

/** "src/**, *.py" → ["src/**", "*.py"]. */
export function splitGlobs(input: string): string[] {
	return input
		.split(',')
		.map((g) => g.trim())
		.filter(Boolean);
}
