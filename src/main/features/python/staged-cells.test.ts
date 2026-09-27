import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CellStager, KEEP_CELLS, removeCellFiles } from './staged-cells';

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-cells-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('CellStager', () => {
	it('never reuses a number, so queued cells keep their own code', () => {
		const cells = new CellStager(join(dir, 'cells'));
		// More than the old ring of 8 while "a long cell runs": each keeps its own file.
		const numbers = Array.from({ length: 20 }, (_, i) => cells.stage(`x = ${i}`, null));
		expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i));
		for (const n of numbers)
			expect(readFileSync(join(cells.dir, `cell_${n}.py`), 'utf8')).toBe(`x = ${n}`);
	});

	it('records the source file and deletes only cells far behind the newest', () => {
		const cells = new CellStager(join(dir, 'cells'));
		for (let i = 0; i <= KEEP_CELLS; i++) cells.stage('pass', i === 1 ? 'C:\\w\\a.py' : null);
		expect(existsSync(join(cells.dir, 'cell_0.py'))).toBe(false);
		expect(existsSync(join(cells.dir, 'cell_0.src'))).toBe(false);
		expect(readFileSync(join(cells.dir, 'cell_1.src'), 'utf8')).toBe('C:\\w\\a.py');
		expect(existsSync(join(cells.dir, `cell_${KEEP_CELLS}.py`))).toBe(true);
	});

	it('clears leftover cell files and nothing else', () => {
		writeFileSync(join(dir, 'cell_3.py'), '');
		writeFileSync(join(dir, 'cell_12.src'), '');
		writeFileSync(join(dir, 'settings.json'), '{}');
		removeCellFiles(dir);
		expect(existsSync(join(dir, 'cell_3.py'))).toBe(false);
		expect(existsSync(join(dir, 'cell_12.src'))).toBe(false);
		expect(existsSync(join(dir, 'settings.json'))).toBe(true);
	});
});
