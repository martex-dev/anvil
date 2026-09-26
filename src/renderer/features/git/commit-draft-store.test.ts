import { beforeEach, describe, expect, it } from 'vitest';

import { useCommitDrafts } from './commit-draft-store';

beforeEach(() => useCommitDrafts.setState({ drafts: {} }));

describe('commit drafts', () => {
	it('keeps one draft per workspace root', () => {
		const { setDraft } = useCommitDrafts.getState();
		setDraft('C:\\work\\alpha', 'fix: alpha');
		setDraft('C:\\work\\beta', 'feat: beta');
		setDraft('C:\\work\\alpha', 'fix: alpha, properly');
		expect(useCommitDrafts.getState().drafts).toEqual({
			'C:\\work\\alpha': 'fix: alpha, properly',
			'C:\\work\\beta': 'feat: beta',
		});
	});

	it('drops a draft when it is cleared', () => {
		const { setDraft } = useCommitDrafts.getState();
		setDraft('C:\\work\\alpha', 'wip');
		setDraft('C:\\work\\alpha', '');
		expect(useCommitDrafts.getState().drafts).toEqual({});
	});
});
