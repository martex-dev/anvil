import { describe, expect, it } from 'vitest';

import { searchSnippets, SNIPPETS, snippetsFor } from './library';

/**
 * Walks a body with VS Code snippet grammar and returns a problem description, or null if the
 * placeholders are well formed. A stray `$` (e.g. an unescaped JS template literal) is an error.
 */
function placeholderProblem(body: string): string | null {
	let depth = 0;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch === '\\' && '$}\\'.includes(body[i + 1] ?? '')) {
			i++;
			continue;
		}
		if (ch === '}' && depth > 0) {
			depth--;
			continue;
		}
		if (ch !== '$') continue;
		const rest = body.slice(i + 1);
		const bare = /^\d+/.exec(rest);
		if (bare) {
			i += bare[0].length;
			continue;
		}
		const braced = /^\{(\d+)([:|}])/.exec(rest);
		if (!braced) return `unescaped $ at ${i}: ${body.slice(i, i + 20)}`;
		i += braced[0].length;
		if (braced[2] === ':') depth++;
		if (braced[2] === '|') {
			const end = body.indexOf('|}', i + 1);
			if (end === -1) return `unterminated choice at ${i}`;
			i = end + 1;
		}
	}
	return depth === 0 ? null : `unbalanced placeholder braces (depth ${depth})`;
}

describe('SNIPPETS', () => {
	it('has a healthy number of snippets', () => {
		expect(SNIPPETS.length).toBeGreaterThanOrEqual(40);
	});

	it('uses unique kebab-case ids', () => {
		const ids = SNIPPETS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});

	it('uses unique prefixes per language', () => {
		for (const lang of ['python', 'typescript'] as const) {
			const prefixes = SNIPPETS.filter((s) => s.language === lang).map((s) => s.prefix);
			expect(new Set(prefixes).size).toBe(prefixes.length);
		}
	});

	it('fills every field', () => {
		for (const s of SNIPPETS) {
			expect(s.name.trim(), s.id).not.toBe('');
			expect(s.description.trim(), s.id).not.toBe('');
			expect(s.prefix, s.id).toMatch(/^[a-z0-9-]+$/);
			expect(s.body.trim(), s.id).not.toBe('');
		}
	});

	it.each(SNIPPETS.map((s) => [s.id, s.body] as const))(
		'%s has valid placeholders',
		(_, body) => {
			expect(placeholderProblem(body)).toBeNull();
		},
	);

	it('indents bodies with tabs, never leading spaces', () => {
		for (const s of SNIPPETS) {
			for (const line of s.body.split('\n')) {
				expect(line, `${s.id}: ${line}`).not.toMatch(/^ {2,}/);
			}
		}
	});

	it('Python bodies never start a line with 4 spaces and keep backslashes intact', () => {
		for (const s of snippetsFor('python')) {
			expect(
				s.body.split('\n').some((l) => l.startsWith('    ')),
				s.id,
			).toBe(false);
			// The raw-template helper must strip only its own escapes.
			expect(s.body, s.id).not.toContain('\\${');
		}
	});

	it('never touches keys, seed phrases or transaction signing', () => {
		const forbidden = [
			/private[_ ]?key/i,
			/secret[_ ]?key/i,
			/seed[_ ]?phrase/i,
			/mnemonic/i,
			/sign_transaction/i,
			/send_raw_transaction/i,
			/send_transaction/i,
			/Keypair\.from_secret/i,
			/from_mnemonic/i,
			/\.transact\(/,
		];
		for (const s of SNIPPETS) {
			for (const pattern of forbidden)
				expect(s.body, `${s.id} ${pattern}`).not.toMatch(pattern);
		}
	});

	it('covers every category', () => {
		const categories = new Set(SNIPPETS.map((s) => s.category));
		for (const c of ['Quant', 'Trading', 'Crypto', 'ML', 'Data', 'Python', 'Testing']) {
			expect(categories.has(c as never), c).toBe(true);
		}
	});

	it('shifts positions in the backtest so there is no look-ahead', () => {
		const bt = SNIPPETS.find((s) => s.id === 'py-vector-backtest');
		expect(bt?.body).toContain('.shift(1)');
		expect(bt?.body).toContain('10_000');
	});

	it('escapes JS template literals inside TS bodies', () => {
		const fetchJson = SNIPPETS.find((s) => s.id === 'ts-fetch-json');
		expect(fetchJson?.body).toContain('`HTTP \\${res.status} for \\${url}`');
	});
});

describe('snippetsFor', () => {
	it('returns Python snippets for python', () => {
		const py = snippetsFor('python');
		expect(py.length).toBeGreaterThan(30);
		expect(py.every((s) => s.language === 'python')).toBe(true);
	});

	it('returns TypeScript snippets for typescript and typescriptreact', () => {
		const ts = snippetsFor('typescript');
		expect(ts.length).toBeGreaterThanOrEqual(4);
		expect(ts.length).toBeLessThanOrEqual(6);
		expect(snippetsFor('typescriptreact')).toEqual(ts);
	});

	it('returns nothing for other languages', () => {
		expect(snippetsFor('rust')).toEqual([]);
		expect(snippetsFor('')).toEqual([]);
	});
});

describe('searchSnippets', () => {
	it('finds the Sharpe snippet first', () => {
		expect(searchSnippets('sharpe')[0]?.id).toBe('py-sharpe');
		expect(searchSnippets('  SHARPE ')[0]?.id).toBe('py-sharpe');
	});

	it('ranks name matches ahead of description-only matches', () => {
		const results = searchSnippets('drawdown');
		expect(results[0]?.name.toLowerCase()).toContain('drawdown');
		const firstNonName = results.findIndex((s) => !s.name.toLowerCase().includes('drawdown'));
		const lastName = results
			.map((s) => s.name.toLowerCase().includes('drawdown'))
			.lastIndexOf(true);
		if (firstNonName !== -1) expect(lastName).toBeLessThan(firstNonName);
	});

	it('puts an exact prefix match first', () => {
		expect(searchSnippets('iv')[0]?.id).toBe('py-implied-vol');
	});

	it('matches category and requires every term', () => {
		const crypto = searchSnippets('crypto');
		expect(crypto.length).toBeGreaterThanOrEqual(3);
		expect(crypto.every((s) => s.category === 'Crypto')).toBe(true);
		expect(searchSnippets('solana spl').map((s) => s.id)).toEqual(['py-solana-spl-balances']);
	});

	it('returns everything for an empty query and nothing for nonsense', () => {
		expect(searchSnippets('')).toHaveLength(SNIPPETS.length);
		expect(searchSnippets('zzzz-no-such-snippet')).toEqual([]);
	});
});
