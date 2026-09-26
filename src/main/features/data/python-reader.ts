import { execFile, type ExecFileException } from 'node:child_process';

import type { ColumnType } from '@shared/ipc/channels/data';

import { AnvilError } from '../../core/errors';
import { buildTable, type Cell, type Table } from './table';

/**
 * Reads columnar files with the user's own Python (polars first, then pandas). Anvil ships no
 * Python, and these formats need a real Arrow implementation to read correctly.
 */
const SCRIPT = String.raw`
import json, sys
path, limit = sys.argv[1], int(sys.argv[2])
ext = path.rsplit('.', 1)[-1].lower()
def cell(v):
    # pandas.NA / NaT: NA's truth value raises in the v != v test below.
    if v is None or type(v).__name__ in ('NAType', 'NaTType'):
        return None
    try:
        if v != v:
            return None
    except Exception:
        pass
    return str(v)
def emit(cols, rows, total, engine):
    sys.stdout.write(json.dumps({'columns': cols, 'rows': rows, 'total': total, 'engine': engine}))
try:
    import polars as pl
    if ext == 'parquet':
        lf = pl.scan_parquet(path)
        total = lf.select(pl.len()).collect().item()
        df = lf.head(limit).collect()
    elif ext in ('feather', 'arrow', 'ipc'):
        df = pl.read_ipc(path, memory_map=False)
        total = df.height
        df = df.head(limit)
    else:
        df = pl.read_excel(path)
        total = df.height
        df = df.head(limit)
    cols = [[name, str(dtype)] for name, dtype in df.schema.items()]
    emit(cols, [[cell(v) for v in row] for row in df.iter_rows()], total, 'polars ' + pl.__version__)
except ImportError:
    import pandas as pd
    if ext == 'parquet':
        df = pd.read_parquet(path)
    elif ext in ('feather', 'arrow', 'ipc'):
        df = pd.read_feather(path)
    else:
        df = pd.read_excel(path)
    total = len(df)
    df = df.head(limit)
    cols = [[str(name), str(dtype)] for name, dtype in df.dtypes.items()]
    emit(cols, [[cell(v) for v in row] for row in df.itertuples(index=False, name=None)], total, 'pandas ' + pd.__version__)
`;

export function mapDtype(dtype: string): ColumnType {
	const d = dtype.toLowerCase();
	// Anchored: pandas 'interval[int64, right]' must not count as an integer column.
	if (/^u?int\d*$/.test(d)) return 'int';
	if (d.startsWith('float') || d.startsWith('decimal')) return 'float';
	if (d.startsWith('bool')) return 'bool';
	if (d.startsWith('date') || d.startsWith('datetime') || d.includes('timestamp')) return 'date';
	return 'string';
}

/** `env` is the interpreter's activated environment (see `activatedEnv`). */
const TIMEOUT_MS = 120_000;

/** Why the reader failed, in words: stderr is empty when the process was killed or never ran. */
export function pythonFailure(error: ExecFileException, stderr: string): string {
	if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
		return 'The file is too large to preview';
	if (error.code === 'ENOENT') return 'Python interpreter not found. Select another one.';
	if (error.killed || error.signal) return `Reading timed out after ${TIMEOUT_MS / 1000} s`;
	const last = stderr.trim().split(/\r?\n/).at(-1);
	return `Python could not read the file: ${last || error.message}`;
}

export function readWithPython(
	python: string,
	env: NodeJS.ProcessEnv,
	absPath: string,
	limit: number,
): Promise<Table> {
	return new Promise((resolve, reject) => {
		execFile(
			python,
			['-c', SCRIPT, absPath, String(limit)],
			{
				env,
				windowsHide: true,
				timeout: TIMEOUT_MS,
				maxBuffer: 512 * 1024 * 1024,
			},
			(error, stdout, stderr) => {
				if (error) {
					const missing =
						/No module named '(pandas|polars|pyarrow|fastexcel|openpyxl)'/.exec(stderr);
					reject(
						new AnvilError(
							'DATA_PYTHON_FAILED',
							missing
								? `Reading this file needs ${missing[1]} in the selected Python env (uv add polars, or pip install pandas pyarrow).`
								: pythonFailure(error, stderr),
						),
					);
					return;
				}
				try {
					const out = JSON.parse(stdout) as {
						columns: Array<[string, string]>;
						rows: Cell[][];
						total: number;
						engine: string;
					};
					const table = buildTable(
						out.columns.map(([name]) => name),
						out.rows,
						out.total > out.rows.length,
						out.engine,
					);
					// The file's own schema beats inference from text.
					table.columns = out.columns.map(([name, dtype]) => ({
						name,
						type: mapDtype(dtype),
					}));
					resolve(table);
				} catch {
					reject(
						new AnvilError(
							'DATA_PYTHON_FAILED',
							'Unexpected output from the Python reader',
						),
					);
				}
			},
		);
	});
}
