/**
 * nbformat 4 → a small, fully-typed model the viewer can render without touching `unknown`.
 * Everything here is pure so it can be unit-tested and reused (e.g. by "Convert to # %% script").
 */

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/svg+xml';

export type NotebookOutput =
	| { kind: 'stream'; name: 'stdout' | 'stderr'; text: string }
	| { kind: 'image'; mime: ImageMime; src: string }
	| { kind: 'text'; text: string }
	| { kind: 'error'; ename: string; evalue: string; traceback: string }
	/** Rich output we deliberately don't render (text/html, widgets…) with no text fallback. */
	| { kind: 'unsupported'; mimes: string[] };

export type CellKind = 'code' | 'markdown' | 'raw';

export interface NotebookCell {
	id: string;
	kind: CellKind;
	source: string;
	executionCount: number | null;
	outputs: NotebookOutput[];
}

export interface Notebook {
	nbformat: number;
	/** Kernel display name, e.g. "Python 3 (ipykernel)". */
	kernel: string | null;
	/** Language used for highlighting and the script export, e.g. "python". */
	language: string;
	cells: NotebookCell[];
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** nbformat stores multiline strings either as one string or as an array of lines. */
export function joinSource(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join('');
	return '';
}

// CSI sequences (colors, cursor moves) and OSC sequences (titles, hyperlinks).
const ANSI = new RegExp(
	[
		'\\u001B\\][^\\u0007\\u001B]*(?:\\u0007|\\u001B\\\\)',
		'[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]',
	].join('|'),
	'g',
);

/** Removes ANSI escape codes (IPython tracebacks are colored for terminals). */
export function stripAnsi(text: string): string {
	return text.replace(ANSI, '');
}

/**
 * Emulates a terminal's carriage return so tqdm-style progress bars show their final state
 * instead of hundreds of intermediate frames.
 */
export function applyCarriageReturns(text: string): string {
	return text
		.split('\n')
		.map((line) => {
			const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line;
			const last = trimmed.lastIndexOf('\r');
			return last === -1 ? trimmed : trimmed.slice(last + 1);
		})
		.join('\n');
}

function imageSrc(mime: ImageMime, data: string): string {
	if (mime === 'image/svg+xml') {
		// An SVG inside <img> can't run scripts or reach the DOM, unlike inline markup.
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
	}
	return `data:${mime};base64,${data.replace(/\s+/g, '')}`;
}

const IMAGE_MIMES: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/svg+xml'];

/** Picks the richest safe representation; text/html is never rendered as markup. */
function richOutput(data: unknown): NotebookOutput | null {
	if (!isObject(data)) return null;
	for (const mime of IMAGE_MIMES) {
		const value = joinSource(data[mime]);
		if (value) return { kind: 'image', mime, src: imageSrc(mime, value) };
	}
	if ('text/plain' in data)
		return { kind: 'text', text: stripAnsi(joinSource(data['text/plain'])) };
	const mimes = Object.keys(data);
	return mimes.length > 0 ? { kind: 'unsupported', mimes } : null;
}

function parseOutput(raw: unknown): NotebookOutput | null {
	if (!isObject(raw)) return null;
	switch (raw['output_type']) {
		case 'stream':
			return {
				kind: 'stream',
				name: raw['name'] === 'stderr' ? 'stderr' : 'stdout',
				// Carriage returns are resolved after merging (mergeStreams): a progress bar's
				// frames are often split across chunks, and one chunk alone can't be resolved.
				text: stripAnsi(joinSource(raw['text'])),
			};
		case 'execute_result':
		case 'display_data':
			return richOutput(raw['data']);
		case 'error': {
			const traceback = Array.isArray(raw['traceback'])
				? raw['traceback'].filter((l) => typeof l === 'string').join('\n')
				: '';
			return {
				kind: 'error',
				ename: typeof raw['ename'] === 'string' ? raw['ename'] : 'Error',
				evalue: typeof raw['evalue'] === 'string' ? stripAnsi(raw['evalue']) : '',
				traceback: stripAnsi(traceback),
			};
		}
		default:
			return null;
	}
}

/**
 * Jupyter splits one print loop into many stream chunks; merge neighbours of the same name, then
 * resolve carriage returns over the whole merged text so tqdm bars show only their final frame.
 */
function mergeStreams(outputs: readonly NotebookOutput[]): NotebookOutput[] {
	const merged: NotebookOutput[] = [];
	for (const output of outputs) {
		const prev = merged[merged.length - 1];
		if (output.kind === 'stream' && prev?.kind === 'stream' && prev.name === output.name) {
			merged[merged.length - 1] = { ...prev, text: prev.text + output.text };
		} else {
			merged.push(output);
		}
	}
	return merged.map((output) =>
		output.kind === 'stream' ? { ...output, text: applyCarriageReturns(output.text) } : output,
	);
}

function parseCell(raw: unknown, index: number): NotebookCell | null {
	if (!isObject(raw)) return null;
	const type = raw['cell_type'];
	if (type !== 'code' && type !== 'markdown' && type !== 'raw') return null;
	const outputs = Array.isArray(raw['outputs'])
		? raw['outputs'].map(parseOutput).filter((o): o is NotebookOutput => o !== null)
		: [];
	const count = raw['execution_count'];
	return {
		id: typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : `cell-${index}`,
		kind: type,
		source: joinSource(raw['source']),
		executionCount: typeof count === 'number' ? count : null,
		outputs: mergeStreams(outputs),
	};
}

/** Parses notebook JSON. Throws an Error with a user-facing message when it isn't nbformat 4. */
export function parseNotebook(text: string): Notebook {
	let root: unknown;
	try {
		root = JSON.parse(text);
	} catch (error) {
		throw new Error(
			`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		);
	}
	if (!isObject(root)) throw new Error('Not a Jupyter notebook: expected a JSON object.');
	const nbformat = typeof root['nbformat'] === 'number' ? root['nbformat'] : 0;
	if (nbformat < 4 || !Array.isArray(root['cells'])) {
		throw new Error(
			nbformat > 0 && nbformat < 4
				? `nbformat ${nbformat} is not supported; re-save the notebook with Jupyter 4+.`
				: 'Not a Jupyter notebook: missing "cells".',
		);
	}
	const metadata = isObject(root['metadata']) ? root['metadata'] : {};
	const kernelspec = isObject(metadata['kernelspec']) ? metadata['kernelspec'] : {};
	const languageInfo = isObject(metadata['language_info']) ? metadata['language_info'] : {};
	const language =
		(typeof languageInfo['name'] === 'string' && languageInfo['name']) ||
		(typeof kernelspec['language'] === 'string' && kernelspec['language']) ||
		'python';
	const kernel =
		(typeof kernelspec['display_name'] === 'string' && kernelspec['display_name']) ||
		(typeof kernelspec['name'] === 'string' && kernelspec['name']) ||
		null;
	// Ids key React lists and collapse state; hand-edited notebooks sometimes duplicate them.
	const seen = new Set<string>();
	const cells = root['cells']
		.map((cell, i) => parseCell(cell, i))
		.filter((c): c is NotebookCell => c !== null)
		.map((cell, i) => {
			const id = seen.has(cell.id) ? `${cell.id}-${i}` : cell.id;
			seen.add(id);
			return id === cell.id ? cell : { ...cell, id };
		});
	return { nbformat, kernel, language: language.toLowerCase(), cells };
}

function commentLines(text: string): string {
	return text
		.replace(/\s+$/, '')
		.split(/\r?\n/)
		.map((line) => (line ? `# ${line}` : '#'))
		.join('\n');
}

/** Builds a "percent format" script (VS Code / Jupytext / Spyder cells) from the notebook. */
export function notebookToScript(notebook: Pick<Notebook, 'cells'>): string {
	const blocks = notebook.cells.map((cell) => {
		const source = cell.source.replace(/\s+$/, '');
		switch (cell.kind) {
			case 'code':
				return source ? `# %%\n${source}` : '# %%';
			case 'markdown':
				return source ? `# %% [markdown]\n${commentLines(source)}` : '# %% [markdown]';
			case 'raw':
				return source ? `# %% [raw]\n${commentLines(source)}` : '# %% [raw]';
		}
	});
	return `${blocks.join('\n\n')}\n`;
}

// Languages whose line comment is '#', so the percent format's "# %%" markers stay valid code.
const SCRIPT_EXTENSIONS: Readonly<Record<string, string>> = {
	python: '.py',
	r: '.R',
	julia: '.jl',
};

/** The script extension for a notebook's language; Python when the language is unknown. */
export function scriptExtension(language: string): string {
	return SCRIPT_EXTENSIONS[language.toLowerCase()] ?? '.py';
}

/**
 * `<name><ext>`, else `<name>_cells<ext>`, `<name>_cells2<ext>`… (ext from the notebook's
 * language, `.py` by default) — never overwrites an existing file.
 */
export function scriptFileName(
	notebookName: string,
	existing: ReadonlySet<string>,
	language = 'python',
): string {
	const base = notebookName.replace(/\.ipynb$/i, '');
	const ext = scriptExtension(language);
	// Windows file names are case-insensitive: "Model.py" blocks "model.py".
	const lower = new Set([...existing].map((name) => name.toLowerCase()));
	const taken = (name: string): boolean => lower.has(name.toLowerCase());
	if (!taken(`${base}${ext}`)) return `${base}${ext}`;
	if (!taken(`${base}_cells${ext}`)) return `${base}_cells${ext}`;
	for (let n = 2; ; n++) {
		const name = `${base}_cells${n}${ext}`;
		if (!taken(name)) return name;
	}
}
