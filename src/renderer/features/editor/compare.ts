import { call } from '../../lib/ipc';
import { focusedEditor } from '../../lib/monaco/editors';
import { useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { getModel } from './file-ops';
import { baseName } from './open';

let selected: string | null = null;

export function selectedForCompare(): string | null {
	return selected;
}

/** Another folder was opened: the selected path belonged to the old one. */
export function clearCompareSelection(): void {
	selected = null;
}

export function selectForCompare(path: string): void {
	selected = path;
	toast.info(
		'Selected for compare',
		`${path}: now right-click another file → Compare with Selected.`,
	);
}

/** Current text of a file: the open buffer (unsaved edits included), else what's on disk. */
async function textOf(path: string): Promise<{ text: string; language: string | null } | null> {
	const model = getModel(path);
	if (model) return { text: model.getValue(), language: model.getLanguageId() };
	const file = await call('fs:readFile', path);
	if (file.binary || file.tooLarge) {
		toast.warn('Cannot compare', `${path} is ${file.binary ? 'binary' : 'too large'}.`);
		return null;
	}
	return { text: file.content, language: null };
}

function openDiffTab(
	id: string,
	title: string,
	detail: string,
	original: string,
	modified: string,
	language: string | null,
	path: string | null,
): void {
	useTabsStore.getState().open({
		id,
		kind: 'diff',
		path: null,
		title,
		diff: { title: detail, original, modified, language, path },
	});
}

export async function compareWithSelected(path: string): Promise<void> {
	if (!selected || selected === path) {
		toast.info('Pick a first file', 'Right-click a file → Select for Compare.');
		return;
	}
	try {
		const [a, b] = await Promise.all([textOf(selected), textOf(path)]);
		if (!a || !b) return;
		openDiffTab(
			`diff:cmp:${selected}:${path}`,
			`${baseName(selected)} ↔ ${baseName(path)}`,
			`${selected} ↔ ${path}`,
			a.text,
			b.text,
			b.language ?? a.language,
			path,
		);
	} catch (error) {
		toast.error('Compare failed', error instanceof Error ? error.message : undefined);
	}
}

/** The clipboard against the selection (or the whole file): "what did I just paste over?". */
export async function compareWithClipboard(): Promise<void> {
	const editor = focusedEditor();
	const model = editor?.getModel();
	if (!editor || !model) {
		toast.info('Open a file first');
		return;
	}
	let clip: string;
	try {
		clip = await navigator.clipboard.readText();
	} catch (error) {
		toast.error(
			'Could not read the clipboard',
			error instanceof Error ? error.message : undefined,
		);
		return;
	}
	const sel = editor.getSelection();
	const mine = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
	const name = model.uri.path.split('/').at(-1) ?? 'file';
	openDiffTab(
		`diff:clip:${model.uri.toString()}`,
		`${name} ↔ clipboard`,
		`${sel && !sel.isEmpty() ? 'selection' : name} ↔ clipboard`,
		mine,
		clip,
		model.getLanguageId(),
		null,
	);
}
