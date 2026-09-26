import { describe, expect, it } from 'vitest';

import { SNIPPETS } from './library';
import { placeholderPreview, renderPlaceholders } from './placeholders';

describe('renderPlaceholders', () => {
	it('returns plain text as a single segment', () => {
		expect(renderPlaceholders('print(1)')).toEqual([{ kind: 'text', text: 'print(1)' }]);
	});

	it('returns nothing for an empty body', () => {
		expect(renderPlaceholders('')).toEqual([]);
	});

	it('splits out ${n:default} placeholders', () => {
		expect(renderPlaceholders("df = pd.read_csv('${1:path}')")).toEqual([
			{ kind: 'text', text: "df = pd.read_csv('" },
			{ kind: 'placeholder', index: 1, text: 'path' },
			{ kind: 'text', text: "')" },
		]);
	});

	it('reads bare tab stops $n and ${n} as empty placeholders', () => {
		expect(renderPlaceholders('a$1b${2}c$0')).toEqual([
			{ kind: 'text', text: 'a' },
			{ kind: 'placeholder', index: 1, text: '' },
			{ kind: 'text', text: 'b' },
			{ kind: 'placeholder', index: 2, text: '' },
			{ kind: 'text', text: 'c' },
			{ kind: 'placeholder', index: 0, text: '' },
		]);
	});

	it('shows the first option of a choice and keeps the rest', () => {
		expect(renderPlaceholders('n = ${2|252,365,52|}')).toEqual([
			{ kind: 'text', text: 'n = ' },
			{ kind: 'placeholder', index: 2, text: '252', choices: ['252', '365', '52'] },
		]);
	});

	it('handles escaped commas inside choices', () => {
		const [seg] = renderPlaceholders('${1|a\\,b,c|}');
		expect(seg).toEqual({ kind: 'placeholder', index: 1, text: 'a,b', choices: ['a,b', 'c'] });
	});

	it('flattens nested placeholders into the outer default text', () => {
		expect(renderPlaceholders('${1:foo(${2:x})}!')).toEqual([
			{ kind: 'placeholder', index: 1, text: 'foo(x)' },
			{ kind: 'text', text: '!' },
		]);
	});

	it('resolves escapes and keeps unrelated dollars and braces literal', () => {
		expect(renderPlaceholders('\\${x} \\\\ $x {a}')).toEqual([
			{ kind: 'text', text: '${x} \\ $x {a}' },
		]);
		expect(renderPlaceholders('${1:a\\}b}')).toEqual([
			{ kind: 'placeholder', index: 1, text: 'a}b' },
		]);
	});

	it('keeps a malformed choice visible instead of dropping text', () => {
		expect(placeholderPreview('x ${1|a,b')).toBe('x ${1|a,b');
	});
});

describe('placeholderPreview', () => {
	it('joins defaults into insert-ready text', () => {
		expect(placeholderPreview("rets = ${1|simple,log|}(${2:df['close']})\n$0")).toBe(
			"rets = simple(df['close'])\n",
		);
	});

	it('leaves no snippet syntax behind for any library snippet', () => {
		for (const s of SNIPPETS) {
			const preview = placeholderPreview(s.body);
			expect(preview, s.id).not.toMatch(/\$\{\d/);
			expect(preview.length, s.id).toBeGreaterThan(0);
		}
	});
});
