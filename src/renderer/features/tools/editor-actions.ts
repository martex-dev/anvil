import { getLoadedMonaco } from '../../lib/monaco/load';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import {
	isoNow,
	loremIpsum,
	nanoid,
	randomHex,
	unixMillis,
	unixSeconds,
	uuid,
} from '../transform/generate';
import { insertAtCursors, requireEditor } from './edit-actions';

/**
 * Runs one of Monaco's built-in actions on the focused editor. The action's promise is returned
 * so a failure reaches runCommand, which logs it and shows a toast.
 */
export async function runEditorAction(id: string): Promise<void> {
	const editor = requireEditor();
	if (!editor) return;
	const action = editor.getAction(id);
	if (!action) {
		toast.warn('Not available here', id);
		return;
	}
	await action.run();
}

export async function changeLanguage(): Promise<void> {
	const editor = requireEditor();
	const model = editor?.getModel();
	const monaco = getLoadedMonaco();
	if (!editor || !model || !monaco) return;
	const current = model.getLanguageId();
	const picked = await quickPick({
		title: 'language',
		placeholder: 'Highlight this file as…',
		items: monaco.languages
			.getLanguages()
			.filter((l) => l.aliases?.length)
			.map((l) => ({
				id: l.id,
				label: l.aliases?.[0] ?? l.id,
				description: l.id,
				detail: l.extensions?.slice(0, 6).join(' '),
				current: l.id === current,
			}))
			.sort((a, b) => a.label.localeCompare(b.label)),
	});
	if (picked && picked !== current) monaco.editor.setModelLanguage(model, picked);
	editor.focus();
}

interface Generator {
	id: string;
	label: string;
	make: () => string;
	/** Each cursor gets its own value; the same id twice would defeat the point. */
	unique?: boolean;
}

const GENERATORS: readonly Generator[] = [
	{ id: 'uuid', label: 'UUID v4', make: () => uuid(), unique: true },
	{ id: 'nanoid', label: 'Nano ID', make: () => nanoid(), unique: true },
	{ id: 'iso', label: 'ISO timestamp (UTC)', make: () => isoNow() },
	{ id: 'unix', label: 'Unix timestamp (seconds)', make: () => unixSeconds() },
	{ id: 'unixms', label: 'Unix timestamp (ms)', make: () => unixMillis() },
	{ id: 'hex', label: 'Random hex (32 bytes)', make: () => randomHex(), unique: true },
	{ id: 'lorem', label: 'Lorem ipsum (30 words)', make: () => loremIpsum() },
];

export async function insertGenerated(): Promise<void> {
	const editor = requireEditor();
	if (!editor) return;
	// Sample values are generated now so the picker shows exactly what gets inserted.
	const samples = new Map(GENERATORS.map((g) => [g.id, g.make()]));
	const picked = await quickPick({
		title: 'insert',
		placeholder: 'UUID, timestamp, random hex…',
		items: GENERATORS.map((g) => ({
			id: g.id,
			label: g.label,
			detail: (samples.get(g.id) ?? '').slice(0, 80),
		})),
	});
	const generator = GENERATORS.find((g) => g.id === picked);
	const value = picked ? samples.get(picked) : undefined;
	if (!generator || !value) return;
	// The primary cursor gets the previewed value; other cursors get fresh ones when unique.
	insertAtCursors(editor, generator.unique ? (i) => (i === 0 ? value : generator.make()) : value);
}
