import { editorFontFamily, type Settings } from '@shared/settings';

import { themeById } from '../../styles/theme-list';
import { resolveToken } from '../resolve-color';

export type EditorPrefs = Pick<
	Settings,
	| 'editorFontSize'
	| 'editorLigatures'
	| 'tabSize'
	| 'wordWrap'
	| 'minimap'
	| 'reduceMotion'
	| 'ghostText'
	| 'editorFont'
	| 'editorLineHeight'
	| 'cursorStyle'
	| 'colorSwatches'
>;

function syntaxRules(c: (token: string) => string): unknown[] {
	const rule = (scope: string | string[], token: string, fontStyle?: string): unknown => ({
		scope,
		settings: { foreground: c(token), ...(fontStyle ? { fontStyle } : {}) },
	});
	return [
		rule(['comment', 'punctuation.definition.comment'], '--syn-comment', 'italic'),
		rule(['keyword', 'storage', 'storage.type', 'keyword.operator.new'], '--syn-keyword'),
		rule(
			[
				'keyword.control',
				'keyword.control.flow',
				'keyword.control.import',
				'keyword.control.return',
			],
			'--syn-control',
		),
		rule(['string', 'string.quoted', 'punctuation.definition.string'], '--syn-string'),
		rule(['string.regexp', 'constant.character.escape'], '--syn-regexp'),
		rule(['constant.numeric', 'constant.language.numeric'], '--syn-number'),
		rule(
			[
				'constant.language',
				'variable.language.self',
				'variable.language.this',
				'support.constant',
			],
			'--syn-builtin',
		),
		rule(
			[
				'entity.name.function',
				'support.function',
				'meta.function-call.generic',
				'variable.function',
			],
			'--syn-function',
		),
		rule(
			[
				'entity.name.type',
				'entity.name.class',
				'support.type',
				'support.class',
				'entity.other.inherited-class',
			],
			'--syn-type',
		),
		rule(['variable', 'meta.definition.variable'], '--syn-variable'),
		rule(['variable.parameter', 'meta.function.parameters'], '--syn-parameter', 'italic'),
		rule(
			['variable.other.property', 'meta.attribute', 'support.variable.property'],
			'--syn-property',
		),
		rule(
			[
				'entity.name.function.decorator',
				'meta.decorator',
				'punctuation.definition.decorator',
			],
			'--syn-decorator',
		),
		rule(
			['keyword.operator', 'punctuation.separator', 'punctuation.accessor'],
			'--syn-operator',
		),
		rule(['markup.heading', 'entity.name.section'], '--syn-function', 'bold'),
		rule(['markup.bold'], '--syn-number', 'bold'),
		rule(['markup.italic'], '--syn-keyword', 'italic'),
		rule(['markup.inline.raw', 'markup.fenced_code'], '--syn-string'),
	];
}

/**
 * Colors for the language servers' semantic tokens. Without these, anything basedpyright or
 * tsserver classifies (constants, modules, parameters) keeps the base VS Code theme's color
 * and looks the same in every Anvil theme.
 */
function semanticRules(c: (token: string) => string): Record<string, unknown> {
	const fg = (token: string, extra: Record<string, boolean> = {}): unknown => ({
		foreground: c(token),
		...extra,
	});
	return {
		variable: fg('--syn-variable'),
		'variable.readonly': fg('--syn-number'),
		'variable.defaultLibrary': fg('--syn-builtin'),
		parameter: fg('--syn-parameter', { italic: true }),
		selfParameter: fg('--syn-builtin', { italic: true }),
		property: fg('--syn-property'),
		'property.readonly': fg('--syn-property'),
		enumMember: fg('--syn-number'),
		function: fg('--syn-function'),
		method: fg('--syn-function'),
		'function.defaultLibrary': fg('--syn-builtin'),
		'method.defaultLibrary': fg('--syn-function'),
		builtinFunction: fg('--syn-builtin'),
		decorator: fg('--syn-decorator'),
		class: fg('--syn-type'),
		'class.defaultLibrary': fg('--syn-type'),
		type: fg('--syn-type'),
		typeParameter: fg('--syn-type', { italic: true }),
		interface: fg('--syn-type'),
		enum: fg('--syn-type'),
		struct: fg('--syn-type'),
		namespace: fg('--syn-type'),
		module: fg('--syn-type'),
		keyword: fg('--syn-keyword'),
		'*.deprecated': { strikethrough: true },
	};
}

/**
 * VS Code user settings (JSON) that restyle the default themes with Anvil's tokens: the
 * editor surface is transparent so the glass plate behind it shows through.
 */
export function buildUserConfiguration(prefs: EditorPrefs): string {
	const c = (token: string): string => resolveToken(token);
	const clear = '#00000000';
	const colors = {
		'editor.background': clear,
		'editorGutter.background': clear,
		// Opaque-ish: code scrolled under the minimap must not show through it.
		'minimap.background': c('--bg-1'),
		'minimap.errorHighlight': c('--down-soft'),
		'minimap.warningHighlight': c('--warn-soft'),
		'editor.foreground': c('--text-0'),
		'editorLineNumber.foreground': c('--text-2'),
		'editorLineNumber.activeForeground': c('--editor-accent'),
		'editorCursor.foreground': c('--editor-accent'),
		'editor.lineHighlightBackground': c('--accent-faint'),
		'editor.lineHighlightBorder': clear,
		'editor.selectionBackground': c('--accent-soft'),
		'editor.inactiveSelectionBackground': c('--bg-3'),
		'editor.wordHighlightBackground': c('--accent-faint'),
		'editor.findMatchBackground': c('--warn-soft'),
		'editor.findMatchHighlightBackground': c('--accent-faint'),
		'editorBracketMatch.background': c('--accent-soft'),
		'editorBracketMatch.border': c('--accent'),
		'editorIndentGuide.background1': c('--border'),
		'editorIndentGuide.activeBackground1': c('--border-strong'),
		'editorWhitespace.foreground': c('--border-strong'),
		'editorRuler.foreground': c('--border'),
		'editorWidget.background': c('--bg-2'),
		'editorWidget.border': c('--border-strong'),
		'editorSuggestWidget.background': c('--bg-2'),
		'editorSuggestWidget.border': c('--border-strong'),
		'editorSuggestWidget.selectedBackground': c('--bg-3'),
		'editorSuggestWidget.highlightForeground': c('--accent'),
		'editorHoverWidget.background': c('--bg-2'),
		'editorHoverWidget.border': c('--border-strong'),
		'editorStickyScroll.background': c('--bg-1'),
		'editorStickyScrollHover.background': c('--bg-2'),
		'editorGhostText.foreground': c('--text-2'),
		'editorInlayHint.background': c('--bg-2'),
		'editorInlayHint.foreground': c('--text-2'),
		'editorCodeLens.foreground': c('--text-2'),
		'editorOverviewRuler.border': clear,
		'scrollbarSlider.background': c('--bg-3'),
		'scrollbarSlider.hoverBackground': c('--border-strong'),
		'scrollbarSlider.activeBackground': c('--accent-soft'),
		'minimapSlider.background': c('--accent-faint'),
		'minimapSlider.hoverBackground': c('--accent-soft'),
		focusBorder: c('--accent'),
		'editorError.foreground': c('--down'),
		'editorWarning.foreground': c('--warn'),
		'editorInfo.foreground': c('--info'),
		'editorGutter.addedBackground': c('--up'),
		'editorGutter.modifiedBackground': c('--info'),
		'editorGutter.deletedBackground': c('--down'),
		'peekView.border': c('--accent'),
		'peekViewEditor.background': c('--bg-1'),
		'peekViewResult.background': c('--bg-2'),
		'peekViewTitle.background': c('--bg-2'),
		'diffEditor.insertedLineBackground': c('--up-soft'),
		'diffEditor.insertedTextBackground': c('--up-soft'),
		'diffEditor.removedLineBackground': c('--down-soft'),
		'diffEditor.removedTextBackground': c('--down-soft'),
		'diffEditor.diagonalFill': c('--bg-3'),
		'editorBracketHighlight.foreground1': c('--syn-function'),
		'editorBracketHighlight.foreground2': c('--syn-keyword'),
		'editorBracketHighlight.foreground3': c('--syn-number'),
		'editorBracketHighlight.foreground4': c('--syn-type'),
		'editorBracketHighlight.foreground5': c('--syn-control'),
		'editorBracketHighlight.foreground6': c('--syn-string'),
	};
	const size = prefs.editorFontSize;
	// The live theme (which may be a preview) decides light vs dark for Monaco's base rules.
	const light = themeById(document.documentElement.dataset['theme'] ?? '').kind === 'light';
	return JSON.stringify({
		'workbench.colorTheme': light ? 'Default Light Modern' : 'Default Dark Modern',
		'workbench.colorCustomizations': colors,
		'editor.tokenColorCustomizations': { textMateRules: syntaxRules(c) },
		'editor.semanticTokenColorCustomizations': { enabled: true, rules: semanticRules(c) },
		// The resolved stack: the chosen font, or the skin's own when the setting is 'skin'.
		'editor.fontFamily':
			getComputedStyle(document.documentElement).getPropertyValue('--font-code').trim() ||
			editorFontFamily(prefs.editorFont),
		'editor.fontSize': size,
		'editor.lineHeight': Math.round(size * prefs.editorLineHeight),
		'editor.fontLigatures': prefs.editorLigatures,
		'editor.tabSize': prefs.tabSize,
		'editor.detectIndentation': true,
		'editor.wordWrap': prefs.wordWrap ? 'on' : 'off',
		'editor.minimap.enabled': prefs.minimap,
		'editor.minimap.renderCharacters': false,
		'editor.minimap.scale': 2,
		'editor.renderWhitespace': 'selection',
		'editor.bracketPairColorization.enabled': true,
		'editor.guides.bracketPairs': 'active',
		'editor.stickyScroll.enabled': true,
		'editor.inlineSuggest.enabled': prefs.ghostText,
		'editor.inlineSuggest.showToolbar': 'onHover',
		'editor.suggest.preview': true,
		'editor.linkedEditing': true,
		'editor.smoothScrolling': !prefs.reduceMotion,
		'editor.cursorBlinking': prefs.reduceMotion ? 'solid' : 'expand',
		'editor.cursorSmoothCaretAnimation': prefs.reduceMotion ? 'off' : 'on',
		'editor.cursorWidth': 2,
		'editor.cursorStyle': prefs.cursorStyle,
		'editor.colorDecorators': prefs.colorSwatches,
		'editor.guides.indentation': true,
		'editor.scrollBeyondLastLine': false,
		'editor.padding.top': 10,
		'editor.glyphMargin': true,
		'editor.renderLineHighlight': 'all',
		'editor.inlayHints.enabled': 'onUnlessPressed',
		'editor.unicodeHighlight.ambiguousCharacters': true,
		'files.eol': 'auto',
	});
}
