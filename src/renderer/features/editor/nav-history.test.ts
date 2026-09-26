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
});
