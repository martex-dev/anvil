import { describe, expect, it } from 'vitest';

import { formatReplyTime } from './chat-time';

describe('formatReplyTime', () => {
	const now = new Date(2026, 8, 26, 15, 0).getTime();

	it('shows only the time for a reply from today', () => {
		const at = new Date(2026, 8, 26, 9, 5).getTime();
		expect(formatReplyTime(at, now)).toBe(
			new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
		);
	});

	it('adds the date for older history, and the year when it differs', () => {
		const lastWeek = new Date(2026, 8, 19, 9, 5).getTime();
		const lastYear = new Date(2025, 8, 19, 9, 5).getTime();
		expect(formatReplyTime(lastWeek, now)).not.toBe(formatReplyTime(lastWeek, lastWeek));
		expect(formatReplyTime(lastWeek, now)).not.toContain('2026');
		expect(formatReplyTime(lastYear, now)).toContain('2025');
	});
});
