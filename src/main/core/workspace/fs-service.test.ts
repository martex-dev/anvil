import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FsService } from './fs-service';

let root: string;
let trash: ReturnType<typeof vi.fn<(abs: string) => Promise<void>>>;
let fs: FsService;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-fs-'));
	mkdirSync(join(root, 'src'));
	writeFileSync(join(root, 'src', 'b.ts'), 'export const b = 1;\n');
	writeFileSync(join(root, 'README.md'), '# hi\r\nthere\r\n');
	writeFileSync(join(root, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
	trash = vi.fn<(abs: string) => Promise<void>>(async () => undefined);
	fs = new FsService({ getRoot: () => root, trash, reveal: vi.fn() });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('FsService', () => {
	it('lists folders first, then files, with relative paths', async () => {
		const entries = await fs.list('');
		expect(entries.map((e) => [e.name, e.kind, e.path])).toEqual([
			['src', 'dir', 'src'],
			['img.png', 'file', 'img.png'],
			['README.md', 'file', 'README.md'],
		]);
	});

	it('lists links to folders as folders, and says what a link points at', async () => {
		// 'junction' needs no admin rights on Windows and is ignored elsewhere.
		symlinkSync(join(root, 'src'), join(root, 'linked'), 'junction');
		symlinkSync(join(root, 'missing'), join(root, 'broken'), 'junction');
		const entries = await fs.list('');
		expect(entries.map((e) => [e.name, e.kind, e.targetKind])).toEqual([
			['linked', 'symlink', 'dir'],
			['src', 'dir', undefined],
			['broken', 'symlink', undefined],
			['img.png', 'file', undefined],
			['README.md', 'file', undefined],
		]);
	});

	it('reads text with EOL detection and flags binaries', async () => {
		const readme = await fs.readFile('README.md');
		expect(readme).toMatchObject({ binary: false, eol: '\r\n', content: '# hi\r\nthere\r\n' });
		expect(await fs.readFile('img.png')).toMatchObject({ binary: true, content: '' });
	});

	it('writes, and refuses to overwrite a file changed on disk since it was read', async () => {
		const file = await fs.readFile('src/b.ts');
		const { mtimeMs } = await fs.writeFile('src/b.ts', 'export const b = 2;\n', file.mtimeMs);
		expect(readFileSync(join(root, 'src', 'b.ts'), 'utf8')).toBe('export const b = 2;\n');
		await expect(fs.writeFile('src/b.ts', 'x', mtimeMs - 10_000)).rejects.toMatchObject({
			code: 'FS_CONFLICT',
		});
	});

	it('creates files and folders, rejecting bad names and duplicates', async () => {
		await fs.create('src', 'c.ts', 'file');
		await fs.create('', 'docs', 'dir');
		expect(existsSync(join(root, 'src', 'c.ts'))).toBe(true);
		expect(existsSync(join(root, 'docs'))).toBe(true);
		await expect(fs.create('src', 'c.ts', 'file')).rejects.toMatchObject({ code: 'FS_EXISTS' });
		await expect(fs.create('', 'bad:name', 'file')).rejects.toMatchObject({
			code: 'FS_BAD_NAME',
		});
		await expect(fs.create('..', 'x.ts', 'file')).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
	});

	it('renames, including case-only renames', async () => {
		const renamed = await fs.rename('README.md', 'readme.md');
		expect(renamed.path).toBe('readme.md');
		await expect(fs.rename('src', 'README.md')).rejects.toMatchObject({ code: 'FS_EXISTS' });
	});

	it('trashes through the host (recycle bin), never the root', async () => {
		await fs.trash('src/b.ts');
		expect(trash).toHaveBeenCalledWith(join(root, 'src', 'b.ts'));
		await expect(fs.trash('')).rejects.toThrow();
	});

	it('errors clearly when no folder is open', async () => {
		const none = new FsService({ getRoot: () => null, trash, reveal: vi.fn() });
		await expect(none.list('')).rejects.toMatchObject({ code: 'NO_WORKSPACE' });
	});
});
