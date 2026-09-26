import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUserConfiguration, type EditorPrefs } from './theme';

// Colors come from the live CSS tokens, which a node test has no DOM for.
vi.mock('../resolve-color', () => ({ resolveToken: (token: string) => `color(${token})` }));

let osReducesMotion = false;

const prefs = (reduceMotion: boolean): EditorPrefs => ({
	editorFontSize: 13,
	editorLigatures: true,
	tabSize: 4,
	wordWrap: false,
	minimap: false,
	reduceMotion,
	ghostText: true,
	editorFont: 'jetbrains',
	editorLineHeight: 1.5,
	cursorStyle: 'line',
	colorSwatches: true,
});

const motion = (reduceMotion: boolean): Record<string, unknown> => {
	const config = JSON.parse(buildUserConfiguration(prefs(reduceMotion))) as Record<
		string,
		unknown
	>;
	return {
		smooth: config['editor.smoothScrolling'],
		blink: config['editor.cursorBlinking'],
		caret: config['editor.cursorSmoothCaretAnimation'],
	};
};

describe('buildUserConfiguration motion', () => {
	beforeEach(() => {
		osReducesMotion = false;
		vi.stubGlobal('document', { documentElement: { dataset: {} } });
		vi.stubGlobal('window', {
			matchMedia: (query: string) => ({
				matches: query === '(prefers-reduced-motion: reduce)' && osReducesMotion,
			}),
		});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('animates scrolling and the cursor by default', () => {
		expect(motion(false)).toEqual({ smooth: true, blink: 'expand', caret: 'on' });
	});

	it('stops the animations when the in-app setting asks', () => {
		expect(motion(true)).toEqual({ smooth: false, blink: 'solid', caret: 'off' });
	});

	it('stops the animations when the OS asks for reduced motion', () => {
		osReducesMotion = true;
		expect(motion(false)).toEqual({ smooth: false, blink: 'solid', caret: 'off' });
	});
});

describe('buildUserConfiguration colors', () => {
	beforeEach(() => {
		vi.stubGlobal('document', { documentElement: { dataset: {} } });
		vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('takes the editor surface from a token, not a hard-coded color', () => {
		const config = JSON.parse(buildUserConfiguration(prefs(false))) as {
			'workbench.colorCustomizations': Record<string, string>;
		};
		const colors = config['workbench.colorCustomizations'];
		expect(colors['editor.background']).toBe('color(--editor-surface)');
		expect(colors['editorGutter.background']).toBe('color(--editor-surface)');
	});
});
