/**
 * Fuzzy file matching for Quick Open: every query character must appear in order. Scores favour
 * matches in the file name, consecutive runs, and starts of path segments/words, so "stbt"
 * finds `strategy/backtest.py` and "parq" ranks `prices.parquet` above deep paths.
 */
export interface FuzzyMatch {
	path: string;
	score: number;
	/** Indices into `path` that matched, for highlighting. */
	indices: number[];
}

function greedy(q: string, p: string, start: number): number[] | null {
	const indices: number[] = [];
	let from = start;
	for (const ch of q) {
		const at = p.indexOf(ch, from);
		if (at === -1) return null;
		indices.push(at);
		from = at + 1;
	}
	return indices;
}

function score(indices: number[], p: string, nameStart: number, q: string): number {
	let s = 0;
	indices.forEach((at, i) => {
		s += 1;
		if (i > 0 && at === (indices[i - 1] ?? -2) + 1) s += 5;
		if (at === 0 || '/_-. '.includes(p[at - 1] ?? '')) s += 4;
		if (at >= nameStart) s += 2;
	});
	if (p.slice(nameStart).startsWith(q)) s += 20;
	// Shorter paths win ties.
	return s - p.length * 0.02;
}

export function fuzzyMatch(query: string, path: string): FuzzyMatch | null {
	const q = query.toLowerCase().replace(/\s+/g, '');
	if (!q) return { path, score: 0, indices: [] };
	const p = path.toLowerCase();
	const nameStart = p.lastIndexOf('/') + 1;
	const candidates = [greedy(q, p, nameStart), greedy(q, p, 0)].filter(
		(x): x is number[] => x !== null,
	);
	if (candidates.length === 0) return null;
	let best: FuzzyMatch | null = null;
	for (const indices of candidates) {
		const s = score(indices, p, nameStart, q);
		if (!best || s > best.score) best = { path, score: s, indices };
	}
	return best;
}

export function fuzzyFilter(query: string, paths: readonly string[], limit = 60): FuzzyMatch[] {
	const out: FuzzyMatch[] = [];
	for (const path of paths) {
		const m = fuzzyMatch(query, path);
		if (m) out.push(m);
	}
	return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
