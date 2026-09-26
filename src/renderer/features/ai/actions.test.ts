import { beforeEach, describe, expect, it, vi } from 'vitest';

import { call } from '../../lib/ipc';
import { useToastStore } from '../../stores/toast-store';
import {
	addDocstring,
	askAiAboutProblem,
	askChat,
	fixProblemsHere,
	testFramework,
	vectorize,
} from './actions';
import { useChat } from './chat-store';
import type * as editorContext from './editor-context';
import { type ActiveEditor, activeEditor, problemsContext } from './editor-context';
import { startInlineEdit } from './inline-edit';

vi.mock('./ai-settings', () => ({
	getAiSettings: vi.fn(() =>
		Promise.resolve({ chat: { provider: 'anthropic', model: 'claude-opus-5' } }),
	),
}));

vi.mock('../../lib/ipc', () => ({ call: vi.fn(() => Promise.reject(new Error('no ipc'))) }));
vi.mock('../../stores/workbench-store', () => ({ requestOpenFile: vi.fn() }));
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

describe('testFramework', () => {
	it('asks for the framework that fits the language', () => {
		expect(testFramework('python')).toContain('pytest');
		expect(testFramework('typescript')).toBe('vitest');
		expect(testFramework('go')).toContain('testing');
		expect(testFramework('rust')).toContain('#[test]');
		expect(testFramework('java')).toBe('JUnit 5');
	});

	it('falls back to idiomatic tests instead of vitest', () => {
		expect(testFramework('sql')).toBe('idiomatic sql');
	});
});

describe('feedback instead of silence', () => {
	it('says to open a file when there is no editor', async () => {
		vi.mocked(activeEditor).mockReturnValue(null);
		await fixProblemsHere();
		addDocstring();
		const titles = useToastStore.getState().toasts.map((t) => t.title);
		expect(titles).toEqual(['Open a file first', 'Open a file first']);
		expect(startInlineEdit).not.toHaveBeenCalled();
	});

	it('warns when the file behind a problem cannot be read, and still asks', async () => {
		vi.mocked(call).mockRejectedValueOnce(new Error('EACCES'));
		await askAiAboutProblem({
			path: 'a.py',
			line: 3,
			column: 1,
			message: 'bad',
			severity: 'error',
			source: 'ruff',
		});
		const warn = useToastStore
			.getState()
			.toasts.find((t) => t.title === 'Sent without the file');
		expect(warn?.description).toContain('EACCES');
		expect(useChat.getState().messages[0]?.context?.map((c) => c.kind)).toEqual(['problems']);
	});
});
