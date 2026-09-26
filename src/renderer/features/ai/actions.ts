import type { AiContext } from '@shared/ipc/channels/ai';

import { call } from '../../lib/ipc';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { outlineFor, symbolPath } from '../outline/outline';
import type { Problem } from '../problems/problems-store';
import { getAiSettings } from './ai-settings';
import { useChatFocus } from './chat-focus';
import { useChat } from './chat-store';
import {
	activeEditor,
	fileContext,
	problemsContext,
	selectionContext,
	truncateForContext,
} from './editor-context';
import { startInlineEdit } from './inline-edit';
import { streamOnce } from './requests';

/** Opens the AI panel and sends a prompt with the given context attached. */
export async function askChat(prompt: string, context: AiContext[]): Promise<void> {
	useLayoutStore.getState().toggleAi(true);
	const { chat: model } = await getAiSettings();
	const chat = useChat.getState();
	// Check before attaching: chips left behind would go out with the next, unrelated message.
	if (chat.activeRequest) {
		toast.info('A reply is still streaming', 'Wait for it or press Stop, then try again.');
		return;
	}
	for (const c of context) chat.attach(c);
	chat.send(prompt, model);
}

/** File + selection (or the function under the cursor) as context. */
function codeContext(preferSymbol: boolean): { context: AiContext[]; what: string } | null {
	const ed = activeEditor();
	if (!ed) {
		toast.info('Open a file first');
		return null;
	}
	const context: AiContext[] = [fileContext(ed)];
	const sel = selectionContext(ed);
	if (sel) {
		context.push(sel);
		return { context, what: `the selected code (${sel.label})` };
	}
	if (preferSymbol) {
		const line = ed.editor.getPosition()?.lineNumber ?? 1;
		const symbols = outlineFor(ed.language, ed.model.getLinesContent());
		const inner = symbolPath(symbols, line).at(-1);
		if (inner) {
			const text = ed.model
				.getLinesContent()
				.slice(inner.line - 1, inner.end)
				.join('\n');
			context.push({
				kind: 'selection',
				label: `${ed.path}:${inner.line}-${inner.end}`,
				language: ed.language,
				text,
			});
			return { context, what: `\`${inner.name}\` (${ed.path}:${inner.line})` };
		}
	}
	return { context, what: `\`${ed.path}\`` };
}

export async function explainCode(): Promise<void> {
	const c = codeContext(true);
	if (c)
		await askChat(
			`Explain ${c.what}: what it does, the key steps, and anything surprising or risky.`,
			c.context,
		);
}

export async function reviewCode(): Promise<void> {
	const c = codeContext(false);
	if (c)
		await askChat(
			`Review ${c.what} for bugs, edge cases and performance problems. Be specific and show fixes.`,
			c.context,
		);
}

export async function writeTests(): Promise<void> {
	const c = codeContext(true);
	const ed = activeEditor();
	if (!c || !ed) return;
	const framework =
		ed.language === 'python' ? 'pytest (fixtures and parametrize where useful)' : 'vitest';
	await askChat(
		`Write ${framework} tests for ${c.what}. Cover normal cases, edge cases (empty input, NaN, zero division) and one property that must always hold. Return a complete test file.`,
		c.context,
	);
}

/** Quant-specific review: the classic ways a backtest lies to you. */
export async function checkLookahead(): Promise<void> {
	const c = codeContext(false);
	if (c)
		await askChat(
			`Audit ${c.what} for look-ahead bias and data leakage: features using future data, labels leaking into features, scaling/normalising on the full sample, shift() direction mistakes, survivorship bias, resampling that peeks at the bar close, and train/test splits that aren't time-ordered (purging/embargo). List each issue with the line and a fix.`,
			c.context,
		);
}

export async function fixProblemsHere(): Promise<void> {
	const ed = activeEditor();
	const monaco = getLoadedMonaco();
	if (!ed || !monaco) return;
	const line = ed.editor.getPosition()?.lineNumber ?? 1;
	const problems = problemsContext(
		monaco,
		ed,
		ed.selection
			? { start: ed.selection.startLine, end: ed.selection.endLine }
			: { start: line, end: line },
	);
	if (!problems) {
		toast.info('No problems here', 'Nothing flagged on these lines.');
		return;
	}
	startInlineEdit(
		'Fix these problems: ' +
			problems.text
				.split('\n')
				.map((l) => l.replace(/^.*?\] /, ''))
				.join('; '),
	);
}

export async function askAiAboutProblem(p: Problem): Promise<void> {
	requestOpenFile({ path: p.path, line: p.line, column: p.column });
	const content = await call('fs:readFile', p.path).catch(() => null);
	const context: AiContext[] = [];
	if (content && !content.binary && !content.tooLarge) {
		const { text, truncated } = truncateForContext(content.content);
		if (truncated) toast.info('Sent part of the file', `${p.path} is too long to send whole.`);
		context.push({ kind: 'file', label: p.path, language: null, text });
	}
	context.push({
		kind: 'problems',
		label: `${p.path}:${p.line}`,
		language: null,
		text: `${p.path}:${p.line}:${p.column} [${p.source}] ${p.message}`,
	});
	await askChat(
		`Fix this ${p.severity} at ${p.path}:${p.line}: "${p.message}". Explain the cause in one line, then give the corrected code.`,
		context,
	);
}

export function addDocstring(): void {
	const ed = activeEditor();
	if (!ed) return;
	if (!ed.selection) {
		// Select the function under the cursor so the edit covers it whole.
		const line = ed.editor.getPosition()?.lineNumber ?? 1;
		const inner = symbolPath(outlineFor(ed.language, ed.model.getLinesContent()), line).at(-1);
		if (inner)
			ed.editor.setSelection({
				startLineNumber: inner.line,
				startColumn: 1,
				endLineNumber: inner.end,
				endColumn: ed.model.getLineMaxColumn(inner.end),
			});
	}
	startInlineEdit(
		ed.language === 'python'
			? 'Add a concise Google-style docstring (Args, Returns, Raises; units for financial quantities). Change nothing else.'
			: 'Add a concise TSDoc comment. Change nothing else.',
	);
}

export function vectorize(): void {
	startInlineEdit(
		'Rewrite this to be vectorised (NumPy / pandas / polars) with identical results, including NaN handling. No Python loops over rows.',
	);
}

/** Writes a Conventional Commits message from what's staged, streaming into `onPartial`. */
export async function generateCommitMessage(onPartial: (text: string) => void): Promise<string> {
	const { diff, truncated } = await call('ai:gitDiff', { staged: true });
	if (!diff.trim()) throw new Error('Nothing is staged');
	const text = await streamOnce({
		mode: 'commit',
		messages: [{ role: 'user', content: 'Write the commit message for this staged diff.' }],
		context: [
			{
				kind: 'diff',
				label: truncated ? 'staged diff (truncated)' : 'staged diff',
				language: 'diff',
				text: diff,
			},
		],
		onPartial: (t) => onPartial(t.trim()),
	});
	return text.trim();
}

export function focusChat(withSelection: boolean): void {
	useLayoutStore.getState().toggleAi(true);
	if (withSelection) {
		const ed = activeEditor();
		const sel = ed ? selectionContext(ed) : null;
		if (sel) useChat.getState().attach(sel);
	}
	useChatFocus.getState().focus();
}
