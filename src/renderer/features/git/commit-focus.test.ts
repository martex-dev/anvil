import { beforeEach, describe, expect, it } from 'vitest';

import { useCommitFocus } from './commit-focus';

beforeEach(() => useCommitFocus.setState({ pending: false }));

describe('commit focus requests', () => {
	it('is taken exactly once', () => {
		const { request, consume } = useCommitFocus.getState();
		expect(consume()).toBe(false);
		request();
		expect(consume()).toBe(true);
		expect(consume()).toBe(false);
	});

	it('notifies subscribers so a mounted commit box can act on it', () => {
		let taken = 0;
		const unsubscribe = useCommitFocus.subscribe(() => {
			if (useCommitFocus.getState().consume()) taken++;
		});
		useCommitFocus.getState().request();
		useCommitFocus.getState().request();
		unsubscribe();
		expect(taken).toBe(2);
	});
});
