import type * as Monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../../lib/monaco/setup';

let secretShield = true;
vi.mock('../../../app/hooks/use-settings', () => ({ getSettings: () => ({ secretShield }) }));

const { attachShield, envValueRanges, hiddenSecrets } = await import('./shield');

/** The blurred text of each line. */
const blurred = (lines: string[]): string[] =>
	envValueRanges(lines).map((r) => (lines[r.line - 1] ?? '').slice(r.start - 1, r.end - 1));

describe('envValueRanges', () => {
	it('hides an unquoted value but not its trailing comment', () => {
		expect(blurred(['API_KEY=abc123  # prod key'])).toEqual(['abc123']);
	});

	it('hides a quoted value up to its closing quote, # included', () => {
		expect(blurred(['PASSWORD="abc #123xyz"  # note', "TOKEN='x #y'"])).toEqual([
			'"abc #123xyz"',
			"'x #y'",
		]);
		expect(blurred(['A="say \\"hi\\" #1"'])).toEqual(['"say \\"hi\\" #1"']);
	});

	it('hides the rest of the line when a quote is never closed', () => {
		expect(blurred(['KEY="abc #123   '])).toEqual(['"abc #123']);
	});

	it('skips comments and empty values', () => {
		expect(blurred(['# KEY=value', 'EMPTY=', 'export NAME=x'])).toEqual(['x']);
	});
});

describe('attachShield', () => {
	it('clears its problems in every open file when the shield is off', () => {
		vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		const shown = { uri: 'file:///c/proj/a.py' };
		const background = { uri: 'file:///c/proj/b.py' };
		const clean = { uri: 'file:///c/proj/c.py' };
		const flagged = new Set([shown.uri, background.uri]);
		const setModelMarkers = vi.fn(
			(model: { uri: string }, _owner: string, markers: unknown[]) =>
				markers.length === 0 && flagged.delete(model.uri),
		);
		const monaco = {
			editor: {
				getModels: () => [shown, background, clean],
				getModelMarkers: ({ resource }: { resource: string }) =>
					flagged.has(resource) ? [{}] : [],
				setModelMarkers,
			},
		} as unknown as MonacoApi;
		const noop = { dispose: () => undefined };
		const editor = {
			createDecorationsCollection: () => ({ set: vi.fn(), clear: vi.fn() }),
			getModel: () => shown,
			onDidChangeModel: () => noop,
			onDidChangeModelContent: () => noop,
			onDidChangeCursorSelection: () => noop,
			onDidBlurEditorText: () => noop,
			getSelections: () => [],
		} as unknown as Monaco.editor.IStandaloneCodeEditor;
		secretShield = false;
		attachShield(editor, monaco).dispose();
		expect(flagged.size).toBe(0);
		// Files that had nothing flagged aren't touched (no marker-change churn).
		expect(setModelMarkers).toHaveBeenCalledTimes(2);
		vi.unstubAllGlobals();
	});
});

describe('hiddenSecrets', () => {
	const secrets = [{ line: 2 }, { line: 5 }, { line: 9 }];

	it('reveals the lines a cursor or selection is on', () => {
		expect(hiddenSecrets(secrets, [{ startLineNumber: 5, endLineNumber: 5 }])).toEqual([
			{ line: 2 },
			{ line: 9 },
		]);
		expect(hiddenSecrets(secrets, [{ startLineNumber: 1, endLineNumber: 6 }])).toEqual([
			{ line: 9 },
		]);
	});

	it('hides everything without a cursor', () => {
		expect(hiddenSecrets(secrets, [])).toEqual(secrets);
	});
});
