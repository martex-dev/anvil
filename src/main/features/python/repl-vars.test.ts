import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readReplVars, REPL_VARS_HELPER } from './repl-vars';
import { REPL_STARTUP } from './staged-cells';

/** A Python on PATH, or null: the helper is Python code and is tested by running it. */
function python(): string | null {
	for (const exe of ['python', 'python3']) {
		try {
			execFileSync(exe, ['-c', 'pass'], { stdio: 'ignore' });
			return exe;
		} catch {
			// Try the next name.
		}
	}
	return null;
}

const py = python();
const hasPandas = ((): boolean => {
	try {
		if (py) execFileSync(py, ['-c', 'import pandas, numpy'], { stdio: 'ignore' });
		return py !== null;
	} catch {
		return false;
	}
})();
let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-vars-'));
	writeFileSync(join(dir, 'startup.py'), REPL_STARTUP + REPL_VARS_HELPER);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const run = (cell: string): void => {
	writeFileSync(join(dir, 'cell_1.py'), cell);
	execFileSync(py ?? 'python', ['-c', "exec(open('startup.py').read()); _cell(1)"], {
		cwd: dir,
		env: { ...process.env, ANVIL_CELLS: dir },
	});
};

describe.skipIf(!py)('the REPL variables helper', () => {
	it('summarises user variables after a cell and skips modules, functions and privates', () => {
		run(
			'import os\nx = 41\nname = "momentum"\nbig = list(range(100000))\n_hidden = 1\ndef f(): pass\n',
		);
		const vars = readReplVars(dir);
		expect(vars.map((v) => v.name)).toEqual(['big', 'name', 'x']);
		expect(vars.find((v) => v.name === 'x')).toEqual({
			name: 'x',
			type: 'int',
			size: '',
			value: '41',
		});
		const big = vars.find((v) => v.name === 'big');
		expect(big?.size).toBe('100000');
		// Bounded: a huge list never turns into a huge string.
		expect(big?.value.length).toBeLessThan(210);
	});

	it('still writes the summary when the cell raises', () => {
		expect(() => run('y = 2\nraise ValueError("boom")\n')).toThrow();
		expect(readReplVars(dir).map((v) => v.name)).toEqual(['y']);
	});
});

describe.skipIf(!hasPandas)('the REPL variables helper with pandas', () => {
	it('shows shapes and dtypes for DataFrames and arrays', () => {
		run(
			'import numpy as np, pandas as pd\n' +
				"prices = pd.DataFrame({'a': range(1000), 'b': 1.5})\n" +
				'ret = np.zeros((250, 3))\n',
		);
		const vars = readReplVars(dir);
		expect(vars.find((v) => v.name === 'prices')).toMatchObject({
			type: 'pandas.DataFrame',
			size: '1000 x 2',
		});
		expect(vars.find((v) => v.name === 'ret')).toMatchObject({
			type: 'numpy.ndarray float64',
			size: '250 x 3',
		});
	});
});
