import { describe, expect, it } from 'vitest';

import { NavHistory } from './nav-history';

const at = (path: string, line: number) => ({ path, line, column: 1 });

describe('NavHistory', () => {
	it('records file switches and big jumps, not small moves', () => {
		const h = new NavHistory();
		h.visit(at('a.py', 1));
		h.visit(at('a.py', 5));
		h.visit(at('a.py', 40));
		h.visit(at('b.py', 3));
		expect(h.goBack()).toEqual(at('a.py', 40));
		h.visit(at('a.py', 40));
		expect(h.goBack()).toEqual(at('a.py', 5));
	});

	it('goes forward again, and a new jump clears forward', () => {
		const h = new NavHistory();
		h.visit(at('a.py', 1));
		h.visit(at('b.py', 1));
		expect(h.goBack()).toEqual(at('a.py', 1));
		h.visit(at('a.py', 1));
		expect(h.goForward()).toEqual(at('b.py', 1));
		h.visit(at('b.py', 1));
		h.goBack();
		h.visit(at('a.py', 1));
		h.visit(at('c.py', 9));
		expect(h.goForward()).toBeNull();
	});

	it('forgets closed files', () => {
		const h = new NavHistory();
		h.visit(at('a.py', 1));
		h.visit(at('b.py', 1));
		h.forget('a.py');
		expect(h.goBack()).toBeNull();
	});

	it('forgets everything on clear, so a new folder starts fresh', () => {
		const h = new NavHistory();
		h.visit(at('a.py', 1));
		h.visit(at('b.py', 1));
		h.clear();
		expect(h.canGoBack).toBe(false);
		expect(h.goBack()).toBeNull();
		// The first place after clearing is a starting point, not a jump from the old folder.
		h.visit(at('c.py', 1));
		expect(h.canGoBack).toBe(false);
	});

	it('records the next jump when going back never reported arriving', () => {
		const h = new NavHistory();
		h.visit(at('a.py', 1));
		h.visit(at('b.py', 1));
		// a.py failed to open, so no cursor settles there; the next jump still counts.
		expect(h.goBack()).toEqual(at('a.py', 1));
		h.visit(at('c.py', 5));
		expect(h.goBack()).toEqual(at('b.py', 1));
	});

	it('forgets deleted folders with everything in them', () => {
		const h = new NavHistory();
		h.visit(at('src/a.py', 1));
		h.visit(at('srcx/b.py', 1));
		h.visit(at('c.py', 1));
		h.forget('src');
		expect(h.goBack()).toEqual(at('srcx/b.py', 1));
		expect(h.goBack()).toBeNull();
	});
});
