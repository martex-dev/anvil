import { describe, expect, it } from 'vitest';

import { ago, bytes } from './history-format';

describe('snapshot age', () => {
	const saved = Date.UTC(2026, 8, 26, 9, 0, 0);
	const min = 60_000;

	it('is measured against the given time, so it moves on as the clock does', () => {
		expect(ago(saved, saved + 10_000)).toBe('just now');
		expect(ago(saved, saved + 5 * min)).toBe('5 min ago');
		expect(ago(saved, saved + 3 * 60 * min)).toBe('3 h ago');
		expect(ago(saved, saved + 2 * 24 * 60 * min)).toBe('2 d ago');
	});
});

describe('snapshot size', () => {
	it('shows bytes, then kilobytes', () => {
		expect(bytes(512)).toBe('512 B');
		expect(bytes(2048)).toBe('2.0 KB');
	});
});
