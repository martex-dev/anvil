import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../lib/monaco/setup';
import {
	type EvaluateResult,
	type Scope,
	toEvaluateResult,
	toScopes,
	toVariables,
	type Variable,
} from './dap-types';
import { debugState, dispatch } from './debug-store';
import { expressionAt } from './hover-expression';
import { currentClient } from './session';

/**
 * Evaluates Python in the selected frame. `repl` is the Debug Console (statements allowed),
 * `watch` and `hover` are side-effect-free reads.
 */
export async function evaluate(
	expression: string,
	context: 'repl' | 'watch' | 'hover',
): Promise<EvaluateResult> {
	const dap = currentClient();
	const { status, frameId } = debugState();
	if (!dap || status !== 'paused' || frameId === null)
		throw new Error('Pause the program to evaluate');
	return toEvaluateResult(await dap.request('evaluate', { expression, frameId, context }));
}

/** Children of an expandable value (a dict, a DataFrame, an object). */
export async function childVariables(variablesReference: number): Promise<Variable[]> {
	const dap = currentClient();
	if (!dap || variablesReference <= 0) return [];
	return toVariables((await dap.request('variables', { variablesReference }))['variables']);
}

/** The scopes (Locals, Globals) of a paused frame. */
export async function frameScopes(frameId: number): Promise<Scope[]> {
	const dap = currentClient();
	if (!dap) return [];
	return toScopes((await dap.request('scopes', { frameId }))['scopes']);
}

/** Runs a Debug Console line and prints it with its result or error. */
export async function evaluateInConsole(expression: string): Promise<void> {
	const text = expression.trim();
	if (!text) return;
	dispatch({ type: 'console', kind: 'input', text });
	try {
		const result = await evaluate(text, 'repl');
		// Statements (x = 1, print()) answer with an empty result; nothing to show then.
		if (result.result !== '')
			dispatch({ type: 'console', kind: 'result', text: result.result });
	} catch (error) {
		dispatch({
			type: 'console',
			kind: 'error',
			text: error instanceof Error ? error.message : String(error),
		});
	}
}

const KEYWORDS = new Set(
	'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None'.split(
		' ',
	),
);

/** Shows a variable's value when hovering it while the program is paused. */
export function registerDebugHover(monaco: MonacoApi): Monaco.IDisposable {
	return monaco.languages.registerHoverProvider('python', {
		async provideHover(model, position) {
			const { status, capabilities } = debugState();
			if (status !== 'paused' || capabilities.supportsEvaluateForHovers === false)
				return null;
			const expr = expressionAt(model.getLineContent(position.lineNumber), position.column);
			if (!expr || KEYWORDS.has(expr)) return null;
			try {
				const result = await evaluate(expr, 'hover');
				const type = result.type ? ` (${result.type})` : '';
				return {
					contents: [
						{ value: `**${expr}**${type}` },
						// A fence inside the value (a docstring) would end the code block early.
						{
							value: `\`\`\`text\n${result.result.slice(0, 4000).replace(/```/g, "'''")}\n\`\`\``,
						},
					],
				};
			} catch {
				// Not a name in this frame (a string's contents, an attribute of something unset).
				return null;
			}
		},
	});
}
