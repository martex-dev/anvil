import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type * as JsonFileModule from './json-file';
import { JsonStore } from './json-store';

// Lets a test make settings.json unreadable, like a file a scanner or backup tool holds open.
const lock = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock('./json-file', async (importOriginal) => {
	const actual = await importOriginal<typeof JsonFileModule>();
	return {
		...actual,
		readJsonFile: (path: string): JsonFileModule.JsonFile => {
			if (lock.error) throw lock.error;
			return actual.readJsonFile(path, []);
		},
	};
});

const corruptCopies = (): string[] => readdirSync(dir).filter((n) => n.includes('.corrupt-'));

let dir: string;
let file: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-store-'));
	file = join(dir, 'settings.json');
});

afterEach(() => {
	lock.error = null;
	rmSync(dir, { recursive: true, force: true });
});

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
		expect(corruptCopies()).toHaveLength(1);
	});

	it('reads a file saved with a UTF-8 BOM', () => {
		writeFileSync(file, `\ufeff${JSON.stringify({ font: 15 })}`, 'utf8');
		expect(new JsonStore(file).get('font', z.number(), 13)).toBe(15);
		expect(corruptCopies()).toEqual([]);
	});

	it('keeps a locked file, and merges changes into it once it can be read', () => {
		writeFileSync(file, JSON.stringify({ font: 15, theme: 'dark', old: true }));
		lock.error = Object.assign(new Error('EBUSY: locked'), { code: 'EBUSY' });
		const readErrors: unknown[] = [];
		const store = new JsonStore(file, undefined, 250, undefined, (e) => readErrors.push(e));
		expect(readErrors).toHaveLength(1);
		// Defaults for now; the file is neither moved aside nor replaced by them.
		expect(store.get('font', z.number(), 13)).toBe(13);
		store.set('theme', z.string(), 'light');
		store.delete('old');
		expect(() => store.flush()).toThrow(/EBUSY/);
		expect(corruptCopies()).toEqual([]);
		expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
			font: 15,
			theme: 'dark',
			old: true,
		});

		lock.error = null;
		store.flush();
		expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ font: 15, theme: 'light' });
		expect(store.get('font', z.number(), 13)).toBe(15);
	});

	it('reports a file that parses but is not an object before moving it aside', () => {
		writeFileSync(file, '[1, 2]');
		const issues: string[] = [];
		new JsonStore(file, (key) => issues.push(key));
		expect(issues).toEqual(['<file>']);
		expect(corruptCopies()).toHaveLength(1);
	});

	it('rejects invalid writes', () => {
		const store = new JsonStore(file);
		expect(() => store.set('n', z.number(), 'no' as unknown as number)).toThrow();
	});

	it('reports a failed background write and retries instead of throwing', () => {
		vi.useFakeTimers();
		try {
			// A directory where the temp file should go makes the write fail.
			mkdirSync(`${file}.tmp`);
			const errors: unknown[] = [];
			const store = new JsonStore(file, undefined, 10, (e) => errors.push(e));
			store.set('a', z.number(), 1);
			vi.advanceTimersByTime(10);
			expect(errors).toHaveLength(1);
			rmSync(`${file}.tmp`, { recursive: true });
			vi.advanceTimersByTime(1_000);
			expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 1 });
		} finally {
			vi.useRealTimers();
		}
	});
});
