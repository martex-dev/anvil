import { beforeEach, describe, expect, it } from 'vitest';

import { useCommitDraft } from './commit-draft';

describe('commit draft', () => {
	beforeEach(() => useCommitDraft.setState({ drafts: {} }));

	it('keeps one draft per workspace root', () => {
		const { setDraft } = useCommitDraft.getState();
		setDraft('C:/a', 'fix: a');
		setDraft('C:/b', 'feat: b');
		expect(useCommitDraft.getState().drafts).toEqual({ 'C:/a': 'fix: a', 'C:/b': 'feat: b' });
	});

	it('drops the entry once the message is cleared', () => {
		const { setDraft } = useCommitDraft.getState();
		setDraft('C:/a', 'fix: a');
		setDraft('C:/a', '');
		expect(useCommitDraft.getState().drafts).toEqual({});
	});
});
