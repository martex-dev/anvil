import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readLargeText } from './large-text';

/** A UTF-8 byte order mark, as Windows tools write it. */
const BOM = String.fromCharCode(0xfeff);

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-large-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('readLargeText', () => {
	it('reads text past the editor limit', async () => {
		const pad = 'x'.repeat(6 * 1024 * 1024);
		writeFileSync(join(root, 'big.ipynb'), `${BOM}{"cells": [], "pad": "${pad}"}`);
		const file = await readLargeText(root, 'big.ipynb');
		expect(file).toMatchObject({ tooLarge: false, binary: false, bom: true });
		expect(file.content.startsWith('{"cells"')).toBe(true);
	});

	it('reports binary files without content', async () => {
		writeFileSync(join(root, 'x.bin'), Buffer.from([1, 0, 2]));
		expect(await readLargeText(root, 'x.bin')).toMatchObject({ binary: true, content: '' });
	});

	it('names the file when it is missing and refuses paths outside the folder', async () => {
		await expect(readLargeText(root, 'gone.ipynb')).rejects.toMatchObject({
			code: 'FS_NOT_FOUND',
		});
		await expect(readLargeText(root, '../x.ipynb')).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
	});
});
