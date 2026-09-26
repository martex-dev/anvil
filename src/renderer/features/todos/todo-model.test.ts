import { describe, expect, it } from 'vitest';

import type { SearchMatch } from '@shared/ipc/channels/search';

import { parseTodo, PATTERN } from './todo-model';

/** A match the way ripgrep reports it: the range covers what PATTERN matched. */
function match(text: string): SearchMatch {
	const found = new RegExp(PATTERN).exec(text);
	const start = found?.index ?? 0;
	return {
		line: 3,
		column: start + 1,
		text,
		ranges: [[start, start + (found?.[0].length ?? 0)]],
	};
}

describe('parseTodo', () => {
	it('takes the tag from the matched marker, not from other words on the line', () => {
		expect(parseTodo('a.py', match('DEBUG = 1  # NOTE: tune'))).toMatchObject({
			tag: 'NOTE',
			text: 'tune',
		});
		expect(parseTodo('a.ts', match('// BUG: TODOS view breaks'))).toMatchObject({
			tag: 'BUG',
			text: 'TODOS view breaks',
		});
	});

	it('drops an owner tag and the colon from the description', () => {
		expect(parseTodo('a.py', match('# TODO(marto): fix x')).text).toBe('fix x');
		expect(parseTodo('a.ts', match('/* HACK (jo) : slow path */')).text).toBe('slow path */');
		expect(parseTodo('a.ts', match('// XXX: (a, b) order'))).toMatchObject({
			tag: 'XXX',
			text: '(a, b) order',
		});
		// Nothing after the marker: show the whole line rather than an empty row.
		expect(parseTodo('a.py', match('# TODO:')).text).toBe('# TODO:');
	});

	it('keeps the path and position', () => {
		expect(parseTodo('src/a.py', match('x = 1  # FIXME later'))).toEqual({
			path: 'src/a.py',
			line: 3,
			column: 8,
			tag: 'FIXME',
			text: 'later',
		});
	});
});
