import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealInside, toAbsolute, toRelative, validateName } from './fs-guard';

let base: string;
let root: string;

beforeAll(() => {
	base = mkdtempSync(join(tmpdir(), 'anvil-guard-'));
	root = join(base, 'ws');
	mkdirSync(join(root, 'src'), { recursive: true });
	mkdirSync(join(base, 'outside'));
	// Junctions don't need admin rights on Windows, unlike file symlinks.
	symlinkSync(join(base, 'outside'), join(root, 'escape'), 'junction');
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('toAbsolute', () => {
	it('resolves paths inside the workspace', () => {
		expect(toAbsolute(root, '')).toBe(root);
		expect(toAbsolute(root, 'src/a.ts')).toBe(join(root, 'src', 'a.ts'));
		expect(toAbsolute(root, 'src/../README.md')).toBe(join(root, 'README.md'));
	});

	it.each(['..', '../x', 'src/../../x', 'C:/Windows/System32', '\\\\server\\share', 'a\0b'])(
		'rejects %j',
		(rel) => {
			expect(() => toAbsolute(root, rel)).toThrow();
		},
	);

	it('round-trips to forward-slash relative paths', () => {
		expect(toRelative(root, join(root, 'src', 'a.ts'))).toBe('src/a.ts');
	});
});

describe('assertRealInside', () => {
	it('allows real paths and not-yet-existing files inside the workspace', () => {
		expect(() => assertRealInside(root, join(root, 'src', 'new.ts'))).not.toThrow();
	});

	it('rejects writes through a junction that points outside', () => {
		expect(() => assertRealInside(root, join(root, 'escape', 'pwned.txt'))).toThrow(/outside/);
	});
});

describe('validateName', () => {
	it.each(['index.ts', '.env.example', 'My File (2).md'])('accepts %j', (name) => {
		expect(() => validateName(name)).not.toThrow();
	});

	it.each([
		'',
		'.',
		'..',
		'a/b',
		'a\\b',
		'what?',
		'CON',
		'nul.txt',
		'COM1',
		'trailing.',
		'space ',
	])('rejects %j', (name) => {
		expect(() => validateName(name)).toThrow();
	});
});
