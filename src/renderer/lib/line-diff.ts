/** A changed region of the new text, in 1-based line numbers. */
export interface LineChange {
	kind: 'added' | 'modified' | 'deleted';
	/** First new line (for 'deleted': the line after which lines were removed; 0 = top). */
	start: number;
	/** Last new line, inclusive (equals start - 1 for 'deleted'). */
	end: number;
}

/**
 * Myers' O(ND) diff over lines, reduced to gutter hunks. Common prefix/suffix are trimmed first,
 * so typical edits (a few lines in a big file) cost almost nothing. Gives up (returns null) past
 * `maxCost` edit steps: a gutter isn't worth freezing the UI over a rewritten file.
 */
export function diffLines(oldText: string, newText: string, maxCost = 4000): LineChange[] | null {
	const a = oldText.split(/\r?\n/);
	const b = newText.split(/\r?\n/);
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
	const changes: LineChange[] = [];
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && keepA[i] && keepB[j]) {
			i++;
			j++;
			continue;
		}
		let removed = 0;
		let inserted = 0;
		const startB = j;
		while (i < n && !keepA[i]) {
			i++;
			removed++;
		}
		while (j < m && !keepB[j]) {
			j++;
			inserted++;
		}
		if (removed === 0 && inserted === 0) {
			// Defensive: never loop forever on an inconsistent trace.
			i++;
			j++;
			continue;
		}
		const start = pre + startB + 1;
		if (inserted === 0) changes.push({ kind: 'deleted', start, end: start - 1 });
		else
			changes.push({
				kind: removed === 0 ? 'added' : 'modified',
				start,
				end: start + inserted - 1,
			});
	}
	return changes;
}
