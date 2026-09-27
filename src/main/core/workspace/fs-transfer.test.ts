import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copyItem, copyName, moveItem, type TransferHost } from './fs-transfer';

let root: string;
let host: TransferHost & { trash: ReturnType<typeof vi.fn<(abs: string) => Promise<void>>> };

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-transfer-'));
	mkdirSync(join(root, 'src', 'lib'), { recursive: true });
	mkdirSync(join(root, 'out'));
	writeFileSync(join(root, 'src', 'bt.py'), 'print(1)\n');
	writeFileSync(join(root, 'src', 'lib', 'util.py'), 'x = 1\n');
	host = {
		trash: vi.fn<(abs: string) => Promise<void>>(async (abs) =>
			rmSync(abs, { recursive: true, force: true }),
		),
	};
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('copyName', () => {
	it('keeps a free name and adds " copy" (then a number) on a clash', () => {
		expect(copyName('bt.py', false, new Set())).toBe('bt.py');
		expect(copyName('bt.py', false, new Set(['bt.py']))).toBe('bt copy.py');
		expect(copyName('BT.py', false, new Set(['bt.py', 'bt copy.py']))).toBe('BT copy 2.py');
	});

	it('treats folders and dotfiles as having no extension', () => {
		expect(copyName('v1.2', true, new Set(['v1.2']))).toBe('v1.2 copy');
		expect(copyName('.env', false, new Set(['.env']))).toBe('.env copy');
	});
});

describe('moveItem', () => {
	it('moves files and folders into another folder', async () => {
		expect(await moveItem(host, root, 'src/bt.py', 'out', false)).toMatchObject({
			path: 'out/bt.py',
			kind: 'file',
		});
		expect(existsSync(join(root, 'src', 'bt.py'))).toBe(false);
		expect(await moveItem(host, root, 'src/lib', '', false)).toMatchObject({
			path: 'lib',
			kind: 'dir',
		});
		expect(readFileSync(join(root, 'lib', 'util.py'), 'utf8')).toBe('x = 1\n');
	});

	it('refuses to overwrite unless asked, then sends the old item to the Recycle Bin', async () => {
		writeFileSync(join(root, 'out', 'bt.py'), 'old\n');
		await expect(moveItem(host, root, 'src/bt.py', 'out', false)).rejects.toMatchObject({
			code: 'FS_EXISTS',
		});
		expect(host.trash).not.toHaveBeenCalled();
		await moveItem(host, root, 'src/bt.py', 'out', true);
		expect(host.trash).toHaveBeenCalledWith(join(root, 'out', 'bt.py'));
		expect(readFileSync(join(root, 'out', 'bt.py'), 'utf8')).toBe('print(1)\n');
	});

	it('never moves a folder into itself, the root, or out of the workspace', async () => {
		await expect(moveItem(host, root, 'src', 'src/lib', false)).rejects.toMatchObject({
			code: 'FS_BAD_PATH',
		});
		await expect(moveItem(host, root, 'src', 'src', false)).rejects.toMatchObject({
			code: 'FS_BAD_PATH',
		});
		await expect(moveItem(host, root, 'src/bt.py', '..', false)).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
		await expect(moveItem(host, root, '', 'out', false)).rejects.toMatchObject({
			code: 'FS_BAD_PATH',
		});
		await expect(
			moveItem(host, root, 'src/bt.py', 'src/lib/util.py', false),
		).rejects.toMatchObject({
			code: 'FS_NOT_A_DIR',
		});
	});

	it('treats a move into the same folder as a no-op', async () => {
		expect(await moveItem(host, root, 'src/bt.py', 'src', false)).toMatchObject({
			path: 'src/bt.py',
		});
		expect(host.trash).not.toHaveBeenCalled();
	});
});

describe('copyItem', () => {
	it('copies files and folders, naming clashes " copy"', async () => {
		expect(await copyItem(host, root, 'src/bt.py', 'out')).toMatchObject({ path: 'out/bt.py' });
		expect(await copyItem(host, root, 'src/bt.py', 'src')).toMatchObject({
			path: 'src/bt copy.py',
		});
		expect(await copyItem(host, root, 'src/bt.py', 'src')).toMatchObject({
			path: 'src/bt copy 2.py',
		});
		expect(await copyItem(host, root, 'src/lib', 'src')).toMatchObject({
			path: 'src/lib copy',
			kind: 'dir',
		});
		expect(readFileSync(join(root, 'src', 'lib copy', 'util.py'), 'utf8')).toBe('x = 1\n');
	});

	it('never copies a folder into itself', async () => {
		await expect(copyItem(host, root, 'src', 'src/lib')).rejects.toMatchObject({
			code: 'FS_BAD_PATH',
		});
	});
});
