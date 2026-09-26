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

	it('lists linked folders as expandable folders with a link flag', async () => {
		// Junctions don't need admin rights on Windows, unlike directory symlinks.
		symlinkSync(join(root, 'src'), join(root, 'linked'), 'junction');
		symlinkSync(join(root, 'missing'), join(root, 'dangling'), 'junction');
		const entries = await fs.list('');
		expect(entries.find((e) => e.name === 'linked')).toMatchObject({
			kind: 'dir',
			isLink: true,
		});
		expect(entries.find((e) => e.name === 'src')).toMatchObject({ kind: 'dir', isLink: false });
		expect(entries.find((e) => e.name === 'dangling')).toMatchObject({
			kind: 'symlink',
			isLink: true,
		});
		expect((await fs.list('linked')).map((e) => e.name)).toEqual(['b.ts']);
	});

	it('reports a UTF-8 BOM on read and writes it back when asked', async () => {
		writeFileSync(join(root, 'data.csv'), '\ufeffa,b\r\n1,2\r\n', 'utf8');
		const csv = await fs.readFile('data.csv');
		expect(csv).toMatchObject({ bom: true, content: 'a,b\r\n1,2\r\n' });
		await fs.writeFile('data.csv', 'a,b\r\n3,4\r\n', undefined, csv.bom);
		expect(readFileSync(join(root, 'data.csv'), 'utf8')).toBe('\ufeffa,b\r\n3,4\r\n');
		expect((await fs.readFile('README.md')).bom).toBe(false);
	});

	it('keeps the bytes of a non-UTF-8 (Windows-1252) file when saving', async () => {
		writeFileSync(join(root, 'prices.csv'), Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]));
		const csv = await fs.readFile('prices.csv');
		expect(csv).toMatchObject({ content: 'café\n', encoding: 'windows-1252' });
		await fs.writeFile('prices.csv', 'caf\u00e9!\n', undefined, csv.bom, csv.encoding);
		expect(readFileSync(join(root, 'prices.csv'))).toEqual(
			Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x21, 0x0a]),
		);
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
