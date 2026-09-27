import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
vi.mock('../editor/extras/git-lines', () => ({ invalidateGitLines: vi.fn() }));

const { branchItems } = await import('./branch-actions');

describe('branchItems', () => {
	it('lists local branches, then remote ones without a local branch of the same name', () => {
		const items = branchItems({
			current: 'main',
			local: ['main', 'feature/x'],
			remote: ['origin/main', 'origin/feature/x', 'origin/feature/y', 'upstream/fix'],
		});
		expect(items.map((i) => [i.id, i.current ?? false])).toEqual([
			['main', true],
			['feature/x', false],
			['remote:origin/feature/y', false],
			['remote:upstream/fix', false],
		]);
	});
});
