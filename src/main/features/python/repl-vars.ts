import { readFileSync, watch } from 'node:fs';
import { join } from 'node:path';

import { type ReplVariable, ReplVariablesSchema } from '@shared/ipc/channels/python';

/**
 * Appended to the REPL's startup file: after every cell (IPython's post_run_cell, or `_cell` in
 * plain Python) the user's variables are summarised into ANVIL_CELLS/vars.json for the
 * Variables panel. Kept cheap: builtin containers go through reprlib (bounded), shapes come
 * from `.shape`, and any failure is swallowed so the REPL itself never breaks.
 */
export const REPL_VARS_HELPER = [
	'',
	'def _anvil_describe(_name, _v):',
	'\timport reprlib as _rl',
	'\t_t = type(_v)',
	"\t_tn = _t.__qualname__ if _t.__module__ == 'builtins' else _t.__module__.split('.')[0] + '.' + _t.__qualname__",
	"\t_size = ''",
	"\t_shape = getattr(_v, 'shape', None)",
	'\tif isinstance(_shape, tuple):',
	"\t\t_size = ' x '.join(str(_s) for _s in _shape)",
	"\telif not isinstance(_v, (str, bytes)) and hasattr(_v, '__len__'):",
	'\t\ttry:',
	'\t\t\t_size = str(len(_v))',
	'\t\texcept Exception:',
	'\t\t\tpass',
	"\t_dtype = getattr(_v, 'dtype', None)",
	'\tif _dtype is not None and not callable(_dtype):',
	"\t\t_tn += ' ' + str(_dtype)",
	'\t_r = _rl.Repr()',
	'\t_r.maxstring = 160',
	'\t_r.maxother = 160',
	'\ttry:',
	"\t\t_text = _r.repr(_v) if _t.__module__ == 'builtins' else repr(_v)",
	'\texcept Exception:',
	"\t\t_text = '<repr failed>'",
	"\t_text = ' '.join(_text.split())",
	'\tif len(_text) > 200:',
	"\t\t_text = _text[:197] + '...'",
	"\treturn {'name': _name, 'type': _tn, 'size': _size, 'value': _text}",
	'',
	'def _anvil_vars(*_args):',
	'\ttry:',
	'\t\timport json as _j, os as _o, types as _ty',
	"\t\t_d = _o.environ.get('ANVIL_CELLS')",
	'\t\tif not _d:',
	'\t\t\treturn',
	'\t\t_g = globals()',
	'\t\t_out = []',
	"\t\t_skip = ('In', 'Out', 'exit', 'quit', 'get_ipython')",
	'\t\t_kinds = (_ty.ModuleType, _ty.FunctionType, _ty.BuiltinFunctionType, type)',
	'\t\tfor _k in sorted(_g):',
	"\t\t\tif _k.startswith('_') or _k in _skip or isinstance(_g[_k], _kinds):",
	'\t\t\t\tcontinue',
	'\t\t\ttry:',
	'\t\t\t\t_out.append(_anvil_describe(_k, _g[_k]))',
	'\t\t\texcept Exception:',
	"\t\t\t\t_out.append({'name': _k, 'type': type(_g[_k]).__name__, 'size': '', 'value': ''})",
	'\t\t\tif len(_out) >= 500:',
	'\t\t\t\tbreak',
	"\t\t_p = _o.path.join(_d, 'vars.json')",
	"\t\twith open(_p + '.tmp', 'w', encoding='utf-8') as _f:",
	'\t\t\t_j.dump(_out, _f)',
	"\t\t_o.replace(_p + '.tmp', _p)",
	'\texcept Exception:',
	'\t\tpass',
	'',
	'try:',
	"\tget_ipython().events.register('post_run_cell', _anvil_vars)",
	'except Exception:',
	'\tpass',
	'_anvil_vars()',
	'',
].join('\n');

/** The last summary the REPL wrote, or an empty list (no REPL yet, or unreadable). */
export function readReplVars(cellsDir: string): ReplVariable[] {
	try {
		const parsed = ReplVariablesSchema.safeParse(
			JSON.parse(readFileSync(join(cellsDir, 'vars.json'), 'utf8')),
		);
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

/** Calls `onChange` with the new summary whenever the REPL rewrites vars.json. */
export function watchReplVars(
	cellsDir: string,
	onChange: (vars: ReplVariable[]) => void,
	onError: (error: Error) => void,
): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const watcher = watch(cellsDir, (_event, file) => {
		if (file !== 'vars.json') return;
		clearTimeout(timer);
		timer = setTimeout(() => onChange(readReplVars(cellsDir)), 100);
	});
	// A watch error (the folder vanished) only costs live updates; the panel can still refresh.
	watcher.on('error', onError);
	return () => {
		clearTimeout(timer);
		watcher.close();
	};
}
