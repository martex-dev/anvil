/** A changed region of the new text, in 1-based line numbers. */
export interface LineChange {
	kind: 'added' | 'modified' | 'deleted';
	/** First new line (for 'deleted': the line after which lines were removed; 0 = top). */
	start: number;
	/** Last new line, inclusive (equals start - 1 for 'deleted'). */
	end: number;
}

/** A run of old lines replaced by new lines; 0-based line indices, counts may be 0. */
export interface LineHunk {
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
}

/**
 * Myers' O(ND) diff over lines, reduced to gutter hunks. Common prefix/suffix are trimmed first,
 * so typical edits (a few lines in a big file) cost almost nothing. Gives up (returns null) past
 * `maxCost` edit steps: a gutter isn't worth freezing the UI over a rewritten file.
 */
export function diffLines(oldText: string, newText: string, maxCost = 4000): LineChange[] | null {
	const hunks = diffHunks(oldText.split(/\r?\n/), newText.split(/\r?\n/), maxCost);
	if (!hunks) return null;
	return hunks.map((h) => {
		const start = h.newStart + 1;
		if (h.newCount === 0) return { kind: 'deleted', start, end: start - 1 };
		return {
			kind: h.oldCount === 0 ? 'added' : 'modified',
			start,
			end: start + h.newCount - 1,
		};
	});
}

/** The same diff as {@link diffLines}, with each hunk's position in both texts. */
export function diffHunks(
	a: readonly string[],
	b: readonly string[],
	maxCost = 4000,
): LineHunk[] | null {
	let pre = 0;
	while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
	let suf = 0;
	while (
		suf < a.length - pre &&
		suf < b.length - pre &&
		a[a.length - 1 - suf] === b[b.length - 1 - suf]
	)
		suf++;
	const A = a.slice(pre, a.length - suf);
	const B = b.slice(pre, b.length - suf);
	const n = A.length;
	const m = B.length;
	if (n === 0 && m === 0) return [];

	// Edit script as a list of (old index, new index) matches found by backtracking Myers' traces.
	const max = n + m;
	const offset = max + 1;
	const v = new Int32Array(2 * max + 3);
	const trace: Int32Array[] = [];
	let found = false;
	for (let d = 0; d <= max; d++) {
		if (d > maxCost) return null;
		trace.push(v.slice());
		for (let k = -d; k <= d; k += 2) {
			let x =
				k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))
					? (v[offset + k + 1] ?? 0)
					: (v[offset + k - 1] ?? 0) + 1;
			let y = x - k;
			while (x < n && y < m && A[x] === B[y]) {
				x++;
				y++;
			}
			v[offset + k] = x;
			if (x >= n && y >= m) {
				found = true;
				break;
			}
		}
		if (found) break;
	}

	// Walk back to mark which lines of A and B are kept (matched).
	const keepA = new Uint8Array(n);
	const keepB = new Uint8Array(m);
	let x = n;
	let y = m;
	for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
		const vd = trace[d];
		if (!vd) break;
		const k = x - y;
		const prevK =
			k === -d || (k !== d && (vd[offset + k - 1] ?? 0) < (vd[offset + k + 1] ?? 0))
				? k + 1
				: k - 1;
		const prevX = vd[offset + prevK] ?? 0;
		const prevY = prevX - prevK;
		while (x > prevX && y > prevY) {
			keepA[--x] = 1;
			keepB[--y] = 1;
		}
		if (d > 0) {
			x = prevX;
			y = prevY;
		}
	}

	// Group runs of removed (A) / inserted (B) lines between matches into hunks.
	const hunks: LineHunk[] = [];
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && keepA[i] && keepB[j]) {
			i++;
			j++;
			continue;
		}
		const startA = i;
		const startB = j;
		while (i < n && !keepA[i]) i++;
		while (j < m && !keepB[j]) j++;
		if (i === startA && j === startB) {
			// Defensive: never loop forever on an inconsistent trace.
			i++;
			j++;
			continue;
		}
		hunks.push({
			oldStart: pre + startA,
			oldCount: i - startA,
			newStart: pre + startB,
			newCount: j - startB,
		});
	}
	return hunks;
}
