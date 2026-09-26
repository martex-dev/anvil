import { beforeEach, describe, expect, it } from 'vitest';

import { codeTabId, focusedTab, useTabsStore } from './tabs-store';

const code = (path: string, preview = false) => ({
	id: codeTabId(path),
	kind: 'code' as const,
	path,
	title: path,
	preview,
});

beforeEach(() => useTabsStore.getState().reset());

describe('tabs store', () => {
	it('opens tabs after the active one and activates them', () => {
		const s = useTabsStore.getState();
		s.open(code('a.py'));
		s.open(code('b.py'));
		s.activate(0, codeTabId('a.py'));
		s.open(code('c.py'));
		expect(useTabsStore.getState().groups[0]?.tabIds).toEqual([
			'code:a.py',
			'code:c.py',
			'code:b.py',
		]);
		expect(focusedTab(useTabsStore.getState())?.path).toBe('c.py');
	});

	it('replaces the preview tab instead of adding another', () => {
		const s = useTabsStore.getState();
		s.open(code('a.py', true));
		s.open(code('b.py', true));
		expect(useTabsStore.getState().groups[0]?.tabIds).toEqual(['code:b.py']);
		s.pin('code:b.py');
		s.open(code('c.py', true));
		expect(useTabsStore.getState().groups[0]?.tabIds).toEqual(['code:b.py', 'code:c.py']);
	});

	it('closing activates the right neighbour and reports whether the tab is gone', () => {
		const s = useTabsStore.getState();
		s.open(code('a.py'));
		s.open(code('b.py'));
		s.open(code('c.py'));
		s.activate(0, 'code:b.py');
		expect(s.close(0, 'code:b.py')).toBe(true);
		expect(useTabsStore.getState().groups[0]?.active).toBe('code:c.py');
	});

	it('splits into a second group and keeps shared tabs alive until both close', () => {
		const s = useTabsStore.getState();
		s.open(code('a.py'));
		s.split('code:a.py');
		let st = useTabsStore.getState();
		expect(st.groups).toHaveLength(2);
		expect(st.focused).toBe(st.groups[1]?.id);
		expect(s.close(st.groups[1]?.id ?? -1, 'code:a.py')).toBe(false);
		st = useTabsStore.getState();
		// The empty second group folds away.
		expect(st.groups).toHaveLength(1);
		expect(st.tabs['code:a.py']).toBeDefined();
	});

	it('closing a group moves its tabs to the remaining one', () => {
		const s = useTabsStore.getState();
		s.open(code('a.py'));
		s.split('code:a.py');
		const second = useTabsStore.getState().groups[1]?.id ?? -1;
		s.open(code('b.py'), { group: second });
		s.closeGroup(second);
		expect(useTabsStore.getState().groups[0]?.tabIds).toEqual(['code:a.py', 'code:b.py']);
	});
});
