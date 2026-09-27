/**
 * Fuzzy file matching for Quick Open: every query character must appear in order. Of all the
 * ways the query fits a path, the best-scoring one wins: consecutive runs, starts of path
 * segments and words, and the file name count most. So "data" picks the `data/` folder in
 * `app/dashboard/data/x.py` rather than d-a from `dashboard`, "stbt" finds
 * `strategy/backtest.py`, and "parq" ranks `prices.parquet` above deep paths.
 */
export interface FuzzyMatch {
	path: string;
	score: number;
	/** Indices into `path` that matched, for highlighting. */
	indices: number[];
}

const MATCH = 1;
const CONSECUTIVE = 5;
const SEGMENT_START = 4;
const CAMEL = 3;
const IN_NAME = 2;
const NAME_PREFIX = 20;
const LENGTH_PENALTY = 0.02;
const BOUNDARY = '/\\_-. ';

// Reused between calls: Quick Open scores tens of thousands of paths per keystroke, and fresh
// arrays per path would churn the garbage collector.
let scores = new Float64Array(0);
let parents = new Int32Array(0);

function ensureCapacity(size: number): void {
	if (scores.length >= size) return;
	scores = new Float64Array(size * 2);
	parents = new Int32Array(size * 2);
}

/** Cheap reject before the full scoring: most paths don't contain the query at all. */
function isSubsequence(q: string, p: string): boolean {
	let from = 0;
	for (const ch of q) {
		const at = p.indexOf(ch, from);
		if (at === -1) return false;
		from = at + 1;
	}
	return true;
}

/** What matching a query character at `at` is worth, before any run bonus. */
function positionBonus(path: string, lower: string, at: number, nameStart: number): number {
	let s = MATCH;
	const before = lower[at - 1] ?? '';
	if (at === 0 || BOUNDARY.includes(before)) s += SEGMENT_START;
	else {
		// camelCase hump: loadPrices matches "lp".
		const prev = path[at - 1] ?? '';
		const cur = path[at] ?? '';
		if (prev !== prev.toUpperCase() && cur !== cur.toLowerCase()) s += CAMEL;
	}
	if (at >= nameStart) s += IN_NAME;
	return s;
}

export function fuzzyMatch(query: string, path: string): FuzzyMatch | null {
	const q = query.toLowerCase().replace(/\s+/g, '');
	if (!q) return { path, score: 0, indices: [] };
	const p = path.toLowerCase();
	if (!isSubsequence(q, p)) return null;
	const n = p.length;
	const m = q.length;
	const nameStart = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1;
	ensureCapacity(n * m);
	// scores[i*n + j]: best total with q[0..i] matched and q[i] at path index j (-Infinity: none).
	// Each cell either continues a run from j-1 or jumps from the best cell anywhere before j-1.
	for (let i = 0; i < m; i++) {
		const row = i * n;
		const prevRow = row - n;
		let bestBefore = Number.NEGATIVE_INFINITY;
		let bestBeforeAt = -1;
		for (let j = 0; j < n; j++) {
			if (i > 0 && j >= 2) {
				const v = scores[prevRow + j - 2] ?? Number.NEGATIVE_INFINITY;
				if (v > bestBefore) {
					bestBefore = v;
					bestBeforeAt = j - 2;
				}
			}
			let value = Number.NEGATIVE_INFINITY;
			let parent = -1;
			if (p[j] === q[i]) {
				const bonus = positionBonus(path, p, j, nameStart);
				if (i === 0) value = bonus;
				else {
					const adjacent = j >= 1 ? (scores[prevRow + j - 1] ?? -Infinity) : -Infinity;
					const run = adjacent + bonus + CONSECUTIVE;
					const jump = bestBefore + bonus;
					if (run >= jump && run > Number.NEGATIVE_INFINITY) {
						value = run;
						parent = j - 1;
					} else if (jump > Number.NEGATIVE_INFINITY) {
						value = jump;
						parent = bestBeforeAt;
					}
				}
			}
			scores[row + j] = value;
			parents[row + j] = parent;
		}
	}
	const last = (m - 1) * n;
	let end = -1;
	let best = Number.NEGATIVE_INFINITY;
	for (let j = 0; j < n; j++) {
		const v = scores[last + j] ?? Number.NEGATIVE_INFINITY;
		if (v > best) {
			best = v;
			end = j;
		}
	}
	if (end < 0) return null;
	const indices = new Array<number>(m);
	for (let i = m - 1, j = end; i >= 0; i--) {
		indices[i] = j;
		j = parents[i * n + j] ?? -1;
	}
	const prefix = p.startsWith(q, nameStart) ? NAME_PREFIX : 0;
	// Shorter paths win ties.
	return { path, score: best + prefix - n * LENGTH_PENALTY, indices };
}

export function fuzzyFilter(query: string, paths: readonly string[], limit = 60): FuzzyMatch[] {
	const out: FuzzyMatch[] = [];
	for (const path of paths) {
		const m = fuzzyMatch(query, path);
		if (m) out.push(m);
	}
	return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
