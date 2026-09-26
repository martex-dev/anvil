import type * as Monaco from 'monaco-editor';
import { describe, expect, it } from 'vitest';

import { appliedRange, currentRange } from './inline-range';

const r = (sl: number, sc: number, el: number, ec: number): Monaco.IRange => ({
	startLineNumber: sl,
	startColumn: sc,
	endLineNumber: el,
	endColumn: ec,
});
const tracker = (now: Monaco.IRange | null) => ({
	getRange: () => now as Monaco.Range | null,
});
const model = { getLineMaxColumn: (line: number) => line * 10 };

describe('currentRange', () => {
	it('follows whole lines that moved down after typing above them', () => {
		expect(currentRange(tracker(r(7, 1, 9, 5)), model, r(5, 1, 7, 70))).toEqual(r(7, 1, 9, 90));
	});

	it('keeps an insert point collapsed where it moved to', () => {
		expect(currentRange(tracker(r(4, 3, 4, 3)), model, r(2, 3, 2, 3))).toEqual(r(4, 3, 4, 3));
	});

	it('reports code that was deleted', () => {
		expect(currentRange(tracker(r(5, 1, 5, 1)), model, r(5, 1, 7, 70))).toBeNull();
		expect(currentRange(tracker(null), model, r(5, 1, 7, 70))).toBeNull();
	});
});

describe('appliedRange', () => {
	const lineModel = { getLineMaxColumn: () => 99 };

	it('covers only the inserted characters when inserting mid-line', () => {
		// `foo(|)`: the `)` after the cursor must stay out of the range Reject removes.
		expect(appliedRange(r(3, 5, 3, 5), 'x, y', true, lineModel)).toEqual(r(3, 5, 3, 9));
	});

	it('ends a multi-line insert at the end of its last inserted line', () => {
		expect(appliedRange(r(3, 5, 3, 5), 'a\n  bc', true, lineModel)).toEqual(r(3, 5, 4, 5));
		expect(appliedRange(r(3, 5, 3, 5), 'a\n', true, lineModel)).toEqual(r(3, 5, 4, 1));
	});

	it('spans whole lines for a line edit', () => {
		expect(appliedRange(r(3, 1, 6, 12), 'a\nb', false, lineModel)).toEqual(r(3, 1, 4, 99));
	});
});
