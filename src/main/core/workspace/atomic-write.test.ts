import {
	chmodSync,
	linkSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AtomicWriteOps, SAVE_TEMP_SUFFIX, writeFileAtomic } from './atomic-write';

let dir: string;
const bytes = (s: string): Buffer => Buffer.from(s, 'utf8');
const errno = (code: string): NodeJS.ErrnoException =>
	Object.assign(new Error(`${code}: simulated`), { code });

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-atomic-'));
});
afterEach(() => {
	for (const name of readdirSync(dir)) {
		try {
			chmodSync(join(dir, name), 0o666);
		} catch {
			// Links and vanished files: rmSync below cleans up regardless.
		}
	}
	rmSync(dir, { recursive: true, force: true });
});

const leftovers = (): string[] => readdirSync(dir).filter((n) => n.endsWith(SAVE_TEMP_SUFFIX));

describe('writeFileAtomic', () => {
	it('replaces an existing file and leaves no temp file behind', async () => {
		const file = join(dir, 'a.py');
		writeFileSync(file, 'old contents that are longer');
		await writeFileAtomic(file, bytes('new'));
		expect(readFileSync(file, 'utf8')).toBe('new');
		expect(leftovers()).toEqual([]);
	});

	it('creates a file that does not exist yet', async () => {
		const file = join(dir, 'new.py');
		await writeFileAtomic(file, bytes('x = 1\n'));
		expect(readFileSync(file, 'utf8')).toBe('x = 1\n');
	});

	it('retries a rename that is briefly blocked, like a scanner holding the file', async () => {
		const file = join(dir, 'a.py');
		writeFileSync(file, 'old');
		let failures = 2;
		const ops: AtomicWriteOps = {
			delaysMs: [0, 0, 0],
			rename: vi.fn(async (from: string, to: string) => {
				if (failures-- > 0) throw errno('EPERM');
				await rename(from, to);
			}),
		};
		await writeFileAtomic(file, bytes('new'), ops);
		expect(ops.rename).toHaveBeenCalledTimes(3);
		expect(readFileSync(file, 'utf8')).toBe('new');
		expect(leftovers()).toEqual([]);
	});

	it('writes in place when the rename stays blocked', async () => {
		const file = join(dir, 'a.py');
		writeFileSync(file, 'old');
		const ops: AtomicWriteOps = {
			delaysMs: [0, 0],
			rename: vi.fn(async () => {
				throw errno('EBUSY');
			}),
		};
		await writeFileAtomic(file, bytes('new'), ops);
		expect(ops.rename).toHaveBeenCalledTimes(3);
		expect(readFileSync(file, 'utf8')).toBe('new');
		expect(leftovers()).toEqual([]);
	});

	it('keeps the original when the failure is not a lock', async () => {
		const file = join(dir, 'a.py');
		writeFileSync(file, 'old');
		const ops: AtomicWriteOps = {
			delaysMs: [0],
			rename: async () => {
				throw errno('ENOSPC');
			},
		};
		await expect(writeFileAtomic(file, bytes('new'), ops)).rejects.toMatchObject({
			code: 'ENOSPC',
		});
		expect(readFileSync(file, 'utf8')).toBe('old');
		expect(leftovers()).toEqual([]);
	});

	it('writes hard-linked files in place so every name sees the change', async () => {
		const file = join(dir, 'a.py');
		const other = join(dir, 'b.py');
		writeFileSync(file, 'old');
		linkSync(file, other);
		await writeFileAtomic(file, bytes('new'));
		expect(readFileSync(other, 'utf8')).toBe('new');
		expect(statSync(file).nlink).toBe(2);
	});

	it('saves through a symlinked file without replacing the link', async () => {
		const real = join(dir, 'real.py');
		const link = join(dir, 'link.py');
		writeFileSync(real, 'old');
		// A file symlink needs developer mode on Windows; skip the check where it's unavailable.
		try {
			symlinkSync(real, link, 'file');
		} catch {
			return;
		}
		await writeFileAtomic(link, bytes('new'));
		expect(readFileSync(real, 'utf8')).toBe('new');
		expect(readdirSync(dir).sort()).toEqual(['link.py', 'real.py']);
	});

	it('refuses a read-only file instead of replacing it', async () => {
		const file = join(dir, 'locked.py');
		writeFileSync(file, 'old');
		chmodSync(file, 0o444);
		await expect(writeFileAtomic(file, bytes('new'))).rejects.toMatchObject({
			code: 'FS_READ_ONLY',
		});
		expect(readFileSync(file, 'utf8')).toBe('old');
	});
});
