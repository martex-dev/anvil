import { describe, expect, it } from 'vitest';

import { buildReplaceRegex, replaceOnLines, rustToJsRegex } from './search-replace';

describe('rustToJsRegex', () => {
	it('converts the syntax only Rust understands', () => {
		expect(rustToJsRegex('(?P<name>\\w+)')).toBe('(?<name>\\w+)');
		expect(rustToJsRegex('\\Afoo\\z')).toBe('^foo$');
		expect(rustToJsRegex('[[:digit:][:upper:]]+')).toBe('[0-9A-Z]+');
		// Escaped backslashes and literal brackets are left alone.
		expect(rustToJsRegex('\\\\A[]a]')).toBe('\\\\A[]a]');
	});

	it('handles leading inline flags', () => {
		const re = buildReplaceRegex({ query: '(?i)price', regex: true, caseSensitive: true });
		expect('PRICE'.replace(re, 'x')).toBe('x');
	});
});

describe('buildReplaceRegex', () => {
	it('matches whole words the way ripgrep does, Unicode included', () => {
		const re = buildReplaceRegex({ query: 'café', wholeWord: true, caseSensitive: true });
		expect('café cafés xcafé café'.replace(re, '_')).toBe('_ cafés xcafé _');
	});

	it('escapes literal queries, including characters /u mode is picky about', () => {
		const re = buildReplaceRegex({ query: 'a-b.c(1)', caseSensitive: true });
		expect('a-b.c(1) aXbXc(1)'.replace(re, 'z')).toBe('z aXbXc(1)');
	});
});

describe('replaceOnLines', () => {
	const text = 'price = 1\r\nlet price = 2\r\nprice price\r\n';

	it('replaces only on the given lines and keeps CRLF', () => {
		const r = replaceOnLines(text, [1, 3], { query: 'price' }, 'cost');
		expect(r).toEqual({
			text: 'cost = 1\r\nlet price = 2\r\ncost cost\r\n',
			count: 3,
			stale: [],
		});
	});

	it('supports groups in regex mode and keeps "$1" literal otherwise', () => {
		const q = { query: '(\\w+) = (\\d)', regex: true };
		expect(replaceOnLines('a = 1', [1], q, '$2 = $1').text).toBe('1 = a');
		expect(replaceOnLines('a = 1', [1], q, '${2}:${1}').text).toBe('1:a');
		const named = { query: '(?P<k>\\w+) = \\d', regex: true };
		expect(replaceOnLines('a = 1', [1], named, '${k}!').text).toBe('a!');
		expect(replaceOnLines('a = 1', [1], { query: 'a' }, '$1').text).toBe('$1 = 1');
		expect(replaceOnLines('ab', [1], { query: 'a', regex: true }, 'x\\ny').text).toBe('x\nyb');
	});

	it('reports lines that no longer match instead of guessing', () => {
		const r = replaceOnLines('nothing here\nprice', [1, 2, 9], { query: 'price' }, 'x');
		expect(r.stale).toEqual([1, 9]);
	});
});
