import type * as Monaco from 'monaco-editor';
import { describe, expect, it } from 'vitest';

import { currentRange } from './inline-range';

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
