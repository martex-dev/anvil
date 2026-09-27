import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Loaded into every Anvil REPL through PYTHONSTARTUP (plain python and IPython both honour it).
 * `_cell(n)` runs staged cell n in the REPL's own namespace, so the prompt echoes a short call
 * instead of a long exec() line. Not `%run -i`: on Windows IPython keeps the quotes of a quoted
 * path, and userData paths often contain spaces. `cell_n.src` names the file the cell came
 * from; compiling under that name makes tracebacks (and terminal links) point at the source.
 */
export const REPL_STARTUP = [
	'# Anvil REPL helpers. _cell(n) runs a staged "# %%" cell in this namespace.',
	'def _cell(n):',
	'\timport os as _os',
	"\t_d = _os.environ['ANVIL_CELLS']",
	"\t_p = _os.path.join(_d, 'cell_%d.py' % n)",
	"\twith open(_p, encoding='utf-8') as _f:",
	'\t\t_code = _f.read()',
	'\ttry:',
	"\t\twith open(_os.path.join(_d, 'cell_%d.src' % n), encoding='utf-8') as _f:",
	'\t\t\t_p = _f.read().strip() or _p',
	'\texcept OSError:',
	'\t\tpass',
	'\ttry:',
	"\t\texec(compile(_code, _p, 'exec'), globals())",
	'\tfinally:',
	'\t\t# IPython refreshes the Variables panel after every run; plain Python only here.',
	"\t\tif 'get_ipython' not in globals() and '_anvil_vars' in globals():",
	'\t\t\t_anvil_vars()',
	'',
].join('\n');

/** Staged cell text: blank lines in front so traceback line numbers match the source file. */
export function stagedCode(code: string, line: number): string {
	return '\n'.repeat(Math.max(0, line - 1)) + code;
}

export function cellCommand(n: number): string {
	return `_cell(${n})`;
}

/**
 * How many staged cells stay on disk. A REPL busy with a long cell still has every later Run
 * Cell queued as `_cell(n)` input, so a cell's file must outlive far more than a few runs.
 */
export const KEEP_CELLS = 64;

/**
 * Writes each staged cell to its own, ever-increasing number. Reusing a small ring of names let
 * a burst of Run Cell presses overwrite cells that were queued but not executed yet, so the
 * REPL ran the wrong code. Only cells KEEP_CELLS behind the newest are deleted.
 */
export class CellStager {
	private next = 0;

	constructor(readonly dir: string) {
		mkdirSync(dir, { recursive: true });
	}

	/** Stages one cell; returns its number for `_cell(n)`. */
	stage(code: string, sourceFile: string | null): number {
		const n = this.next++;
		writeFileSync(join(this.dir, `cell_${n}.py`), code, 'utf8');
		writeFileSync(join(this.dir, `cell_${n}.src`), sourceFile ?? '', 'utf8');
		this.prune(n - KEEP_CELLS);
		return n;
	}

	private prune(n: number): void {
		if (n < 0) return;
		for (const ext of ['py', 'src'])
			rmSync(join(this.dir, `cell_${n}.${ext}`), { force: true });
	}
}

/**
 * Deletes staged cell files in `dir`: at startup, cells of an earlier run belong to REPLs that
 * ended with it (older versions also wrote their ring of cells straight into the data folder).
 */
export function removeCellFiles(dir: string): void {
	for (const name of readdirSync(dir)) {
		if (/^cell_\d+\.(?:py|src)$/.test(name)) rmSync(join(dir, name), { force: true });
	}
}
