import {
	ArrowRightToLine,
	Eye,
	FoldVertical,
	ListTree,
	Map as MapIcon,
	MessageSquareCode,
	PencilLine,
	Pin,
	UnfoldVertical,
	WandSparkles,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { getSettings, updateSettings } from '../../app/hooks/use-settings';
import { runEditorAction } from './editor-actions';

/**
 * Monaco's own editor actions, listed in the palette so they are reachable without knowing the
 * key. No `shortcut` on purpose: Monaco already binds F2, F12 and the rest, and a second binding
 * here would run them twice. The keys are keywords instead, so typing "F12" finds the command.
 */
const builtin = (
	id: string,
	title: string,
	category: Command['category'],
	action: string,
	keys: string[],
	icon?: Command['icon'],
): Command => ({
	id,
	title,
	category,
	keywords: keys,
	...(icon ? { icon } : {}),
	run: () => runEditorAction(action),
});

export const BUILTIN_EDITOR_COMMANDS: Command[] = [
	builtin('editor.organizeImports', 'Organize Imports', 'Edit', 'editor.action.organizeImports', [
		'Shift+Alt+O',
		'sort imports',
		'isort',
		'ruff',
	]),
	builtin('editor.quickFix', 'Quick Fix…', 'Edit', 'editor.action.quickFix', [
		'Ctrl+.',
		'code action',
		'fix lint',
	]),
	builtin(
		'editor.renameSymbol',
		'Rename Symbol',
		'Edit',
		'editor.action.rename',
		['F2', 'refactor'],
		PencilLine,
	),
	builtin(
		'editor.findReferences',
		'Find All References',
		'Go',
		'editor.action.goToReferences',
		['Shift+F12', 'usages'],
		ListTree,
	),
	builtin(
		'go.definition',
		'Go to Definition',
		'Go',
		'editor.action.revealDefinition',
		['F12', 'declaration'],
		ArrowRightToLine,
	),
	builtin(
		'go.peekDefinition',
		'Peek Definition',
		'Go',
		'editor.action.peekDefinition',
		['Alt+F12'],
		Eye,
	),
	builtin(
		'editor.formatDocument',
		'Format Document',
		'Edit',
		'editor.action.formatDocument',
		['Shift+Alt+F', 'prettier', 'ruff', 'beautify'],
		WandSparkles,
	),
	builtin(
		'editor.foldAll',
		'Fold All',
		'View',
		'editor.foldAll',
		['Ctrl+K Ctrl+0', 'collapse'],
		FoldVertical,
	),
	builtin(
		'editor.unfoldAll',
		'Unfold All',
		'View',
		'editor.unfoldAll',
		['Ctrl+K Ctrl+J', 'expand'],
		UnfoldVertical,
	),
	builtin(
		'editor.toggleLineComment',
		'Toggle Line Comment',
		'Edit',
		'editor.action.commentLine',
		['Ctrl+/', 'comment out'],
		MessageSquareCode,
	),
	{
		id: 'view.toggleMinimap',
		title: 'Toggle Minimap',
		category: 'View',
		keywords: ['overview', 'scrollbar'],
		icon: MapIcon,
		// A setting, not Monaco's own toggle: Settings shows it and it survives a restart.
		run: () => updateSettings({ minimap: !getSettings().minimap }),
	},
	{
		id: 'view.toggleStickyScroll',
		title: 'Toggle Sticky Scroll',
		category: 'View',
		keywords: ['pinned', 'headers', 'breadcrumbs'],
		icon: Pin,
		run: () => updateSettings({ stickyScroll: !getSettings().stickyScroll }),
	},
];
