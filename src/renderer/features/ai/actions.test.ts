import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';
import { askChat, fixProblemsHere, vectorize } from './actions';
import { useChat } from './chat-store';
import type * as editorContext from './editor-context';
import { type ActiveEditor, activeEditor, problemsContext } from './editor-context';
import { startInlineEdit } from './inline-edit';

vi.mock('./ai-settings', () => ({
	getAiSettings: vi.fn(() =>
		Promise.resolve({ chat: { provider: 'anthropic', model: 'claude-opus-5' } }),
	),
}));

vi.mock('./inline-edit', () => ({ startInlineEdit: vi.fn() }));
vi.mock('../../lib/monaco/load', () => ({ getLoadedMonaco: () => ({}) }));
vi.mock('./editor-context', async (original) => ({
	...(await original<typeof editorContext>()),
	activeEditor: vi.fn(() => null),
	problemsContext: vi.fn(() => null),
}));

/** A stand-in editor over `lines`, with the cursor on `cursorLine` and nothing selected. */
function fakeEditor(lines: string[], cursorLine: number): ActiveEditor & { selected: unknown[] } {
	const selected: unknown[] = [];
	return {
		path: 'a.py',
		language: 'python',
		selection: null,
		selected,
		editor: {
			getPosition: () => ({ lineNumber: cursorLine, column: 1 }),
			setSelection: (range: unknown) => selected.push(range),
		},
		model: {
			getLinesContent: () => lines,
			getLineMaxColumn: (line: number) => (lines[line - 1]?.length ?? 0) + 1,
		},
	} as unknown as ActiveEditor & { selected: unknown[] };
}

const file = { kind: 'file' as const, label: 'a.py', language: null, text: 'x = 1' };

beforeEach(() => {
	vi.mocked(startInlineEdit).mockReset();
	useToastStore.setState({ toasts: [] });
	useChat.setState({ messages: [], attached: [], activeRequest: null });
});

describe('askChat', () => {
	it('attaches nothing and says why while a reply is streaming', async () => {
		useChat.setState({ activeRequest: 'busy' });
		await askChat('Explain', [file]);
		expect(useChat.getState().attached).toEqual([]);
		expect(useChat.getState().messages).toHaveLength(0);
		expect(useToastStore.getState().toasts.at(-1)?.title).toBe('A reply is still streaming');
	});

	it('sends the prompt with the context attached', async () => {
		await askChat('Explain', [file]);
		const user = useChat.getState().messages[0];
		expect(user).toMatchObject({ role: 'user', content: 'Explain', context: [file] });
		expect(useChat.getState().attached).toEqual([]);
	});
});

describe('inline actions without a selection', () => {
	const code = [
		'def f(xs):',
		'    out = []',
		'    for x in xs:',
		'        out.append(x * 2)',
		'    return out',
	];

	it('vectorize selects the function under the cursor instead of inserting', () => {
		const ed = fakeEditor(code, 3);
		vi.mocked(activeEditor).mockReturnValue(ed);
		vectorize();
		expect(ed.selected).toEqual([
			{ startLineNumber: 1, startColumn: 1, endLineNumber: 5, endColumn: 15 },
		]);
		expect(startInlineEdit).toHaveBeenCalledTimes(1);
	});

	it('vectorize asks for a selection outside any function', () => {
		vi.mocked(activeEditor).mockReturnValue(fakeEditor(['for x in xs:', '    y += x'], 1));
		vectorize();
		expect(startInlineEdit).not.toHaveBeenCalled();
		expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Select the code to vectorize');
	});

	it('fix problems here selects the flagged line', async () => {
		const ed = fakeEditor(code, 4);
		vi.mocked(activeEditor).mockReturnValue(ed);
		vi.mocked(problemsContext).mockReturnValue({
			kind: 'problems',
			label: 'a.py:4',
			language: null,
			text: 'a.py:4:9 [basedpyright] "out" is unbound',
		});
		await fixProblemsHere();
		expect(ed.selected).toEqual([
			{ startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 26 },
		]);
		expect(startInlineEdit).toHaveBeenCalledTimes(1);
	});
});
