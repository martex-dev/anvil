import type * as Fs from 'node:fs';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { moveAside, readJsonFile } from './json-file';

// Lets a test make the next reads fail like a file an antivirus scanner holds open.
const locks = vi.hoisted(() => ({ remaining: 0, code: 'EBUSY' }));
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof Fs>();
	return {
		...actual,
		readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
			if (locks.remaining > 0) {
				locks.remaining--;
				throw Object.assign(new Error(`${locks.code}: simulated`), { code: locks.code });
			}
			return actual.readFileSync(...args);
		}) as typeof actual.readFileSync,
	};
});

let dir: string;
let file: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-json-'));
	file = join(dir, 'settings.json');
	locks.remaining = 0;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('readJsonFile', () => {
	it('tells a missing file from a corrupt one', () => {
		expect(readJsonFile(file)).toEqual({ kind: 'missing' });
		writeFileSync(file, '{"a": ');
		expect(readJsonFile(file)).toMatchObject({ kind: 'corrupt' });
	});

	it('accepts a UTF-8 BOM, as Notepad and PowerShell 5 write it', () => {
		writeFileSync(file, '\ufeff{"a": 1}', 'utf8');
		expect(readJsonFile(file)).toEqual({ kind: 'ok', value: { a: 1 } });
	});

	it('retries a locked file and then reads it', () => {
		writeFileSync(file, '{"a": 1}');
		locks.remaining = 2;
		expect(readJsonFile(file, [0, 0])).toEqual({ kind: 'ok', value: { a: 1 } });
	});

	it('throws instead of calling a file that stays locked corrupt', () => {
		writeFileSync(file, '{"a": 1}');
		locks.remaining = 5;
		expect(() => readJsonFile(file, [0])).toThrow(/EBUSY/);
	});
});

describe('moveAside', () => {
	it('keeps every corrupt copy under its own timestamped name', () => {
		writeFileSync(file, 'one');
		const first = moveAside(file, new Date('2026-09-27T10:00:00.000Z'));
		writeFileSync(file, 'two');
		moveAside(file, new Date('2026-09-27T10:00:01.000Z'));
		expect(first).toBe(`${file}.corrupt-2026-09-27T10-00-00-000Z`);
		expect(existsSync(file)).toBe(false);
		expect(readdirSync(dir).filter((n) => n.includes('.corrupt-'))).toHaveLength(2);
	});
});
