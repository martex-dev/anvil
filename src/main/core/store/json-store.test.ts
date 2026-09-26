import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { JsonStore } from './json-store';

let dir: string;
let file: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-store-'));
	file = join(dir, 'settings.json');
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('JsonStore', () => {
	it('returns the fallback for missing keys', () => {
		const store = new JsonStore(file);
		expect(store.get('x', z.number(), 7)).toBe(7);
	});

	it('persists values across instances after flush', () => {
		const store = new JsonStore(file);
		store.set('font', z.number(), 14);
		store.flush();
		expect(new JsonStore(file).get('font', z.number(), 13)).toBe(14);
	});

	it('falls back and reports when a stored value fails validation', () => {
		writeFileSync(file, JSON.stringify({ font: 'huge' }));
		const issues: string[] = [];
		const store = new JsonStore(file, (key) => issues.push(key));
		expect(store.get('font', z.number(), 13)).toBe(13);
		expect(issues).toEqual(['font']);
	});

	it('treats null as delete', () => {
		const store = new JsonStore(file);
		store.set('a', z.string().nullable(), 'x');
		store.set('a', z.string().nullable(), null);
		store.flush();
		expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({});
	});

	it('moves a corrupt file aside and starts empty', () => {
		writeFileSync(file, '{not json');
		const store = new JsonStore(file);
		expect(store.get('a', z.number(), 1)).toBe(1);
		expect(existsSync(`${file}.corrupt`)).toBe(true);
	});

	it('rejects invalid writes', () => {
		const store = new JsonStore(file);
		expect(() => store.set('n', z.number(), 'no' as unknown as number)).toThrow();
	});
});
