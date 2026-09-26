import {
	Aperture,
	ArrowLeft,
	ArrowRight,
	Calculator,
	ClipboardList,
	Diff,
	Fingerprint,
	Focus,
	NotebookPen,
	Palette,
	SwatchBook,
	WandSparkles,
	WrapText,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { getSettings, updateSettings } from '../../app/hooks/use-settings';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { compareWithClipboard, compareWithSelected, selectForCompare } from '../editor/compare';
import { toggleSpotlight } from '../editor/extras/spotlight';
import { isScratch } from '../editor/file-ops';
import { navHistory } from '../editor/nav-history';
import { openScratchTab } from '../editor/open';
import { openSnapFromEditor } from '../snap/open';
import { cycleAccent, nextTheme, pickTheme } from '../themes/theme-picker';
import { uuid } from '../transform/generate';
import {
	evaluateMath,
	insertAtCursors,
	pasteFromHistory,
	requireEditor,
	transformSelection,
} from './edit-actions';
import { changeLanguage, insertGenerated, runEditorAction } from './editor-actions';

function go(place: { path: string; line: number; column: number } | null): void {
	if (place) requestOpenFile(place);
}

/** The focused tab's file on disk (not the scratchpad or a diff). */
function activeFilePath(): string | null {
	const tab = focusedTab(useTabsStore.getState());
	if (tab?.kind !== 'code' || !tab.path || isScratch(tab.path)) {
		toast.info('Open a file first');
		return null;
	}
	return tab.path;
}

export const TOOL_COMMANDS: Command[] = [
	{
		id: 'anvil.theme',
		title: 'Color Theme…',
		category: 'Anvil',
		shortcut: 'Ctrl+Alt+T',
		icon: SwatchBook,
		keywords: ['dark', 'light', 'colors', 'appearance', 'dracula', 'nord', 'tokyo'],
		run: pickTheme,
	},
	{
		id: 'anvil.nextTheme',
		title: 'Next Color Theme',
		category: 'Anvil',
		run: () => nextTheme(1),
	},
	{
		id: 'anvil.accent',
		title: 'Cycle Accent Color',
		category: 'Anvil',
		icon: Palette,
		run: cycleAccent,
	},
	{
		id: 'tools.scratchpad',
		title: 'Open Scratchpad',
		category: 'Tools',
		shortcut: 'Ctrl+Alt+P',
		icon: NotebookPen,
		keywords: ['notes', 'buffer', 'temp', 'playground'],
		run: openScratchTab,
	},
	{
		id: 'tools.codeSnap',
		title: 'Code Snap: Share Code as Image',
		category: 'Tools',
		shortcut: 'Ctrl+Alt+C',
		icon: Aperture,
		keywords: ['screenshot', 'png', 'carbon', 'share', 'twitter'],
		run: openSnapFromEditor,
	},
	{
		id: 'edit.clipboardHistory',
		title: 'Paste from Clipboard History…',
		category: 'Edit',
		shortcut: 'Ctrl+Alt+V',
		icon: ClipboardList,
		run: pasteFromHistory,
	},
	{
		id: 'edit.transform',
		title: 'Transform Selection…',
		category: 'Edit',
		shortcut: 'Ctrl+Alt+X',
		icon: WandSparkles,
		keywords: ['case', 'snake', 'camel', 'sort', 'base64', 'json', 'url', 'dedupe'],
		run: transformSelection,
	},
	{
		id: 'edit.evaluateMath',
		title: 'Evaluate Math in Selection',
		category: 'Edit',
		shortcut: 'Ctrl+Alt+=',
		icon: Calculator,
		keywords: ['calculate', 'calculator', 'sum'],
		run: evaluateMath,
	},
	{
		id: 'edit.insert',
		title: 'Insert Generated Value… (UUID, timestamp, hex)',
		category: 'Edit',
		shortcut: 'Ctrl+Alt+I',
		icon: Fingerprint,
		keywords: ['uuid', 'guid', 'nanoid', 'timestamp', 'unix', 'epoch', 'lorem', 'random'],
		run: insertGenerated,
	},
	{
		id: 'edit.insertUuid',
		title: 'Insert UUID',
		category: 'Edit',
		run: () => {
			const editor = requireEditor();
			if (editor) insertAtCursors(editor, uuid());
		},
	},
	{
		id: 'go.back',
		title: 'Go Back',
		category: 'Go',
		shortcut: 'Alt+Left',
		scope: 'editor',
		icon: ArrowLeft,
		run: () => go(navHistory.goBack()),
	},
	{
		id: 'go.forward',
		title: 'Go Forward',
		category: 'Go',
		shortcut: 'Alt+Right',
		scope: 'editor',
		icon: ArrowRight,
		run: () => go(navHistory.goForward()),
	},
	{
		id: 'view.spotlight',
		title: 'Toggle Spotlight (dim all but the current block)',
		category: 'View',
		shortcut: 'Ctrl+Alt+D',
		icon: Focus,
		keywords: ['focus', 'zen', 'dim'],
		run: () => {
			toast.info(toggleSpotlight() ? 'Spotlight on' : 'Spotlight off');
		},
	},
	{
		id: 'view.wordWrap',
		title: 'Toggle Word Wrap',
		category: 'View',
		shortcut: 'Alt+Z',
		scope: 'editor',
		icon: WrapText,
		run: () => updateSettings({ wordWrap: !getSettings().wordWrap }),
	},
	{
		id: 'edit.compareClipboard',
		title: 'Compare Active File with Clipboard',
		category: 'Edit',
		icon: Diff,
		keywords: ['diff'],
		run: compareWithClipboard,
	},
	{
		id: 'edit.selectForCompare',
		title: 'Select Active File for Compare',
		category: 'Edit',
		keywords: ['diff'],
		run: () => {
			const path = activeFilePath();
			if (path) selectForCompare(path);
		},
	},
	{
		id: 'edit.compareWithSelected',
		title: 'Compare Active File with Selected',
		category: 'Edit',
		keywords: ['diff'],
		run: async () => {
			const path = activeFilePath();
			if (path) await compareWithSelected(path);
		},
	},
	{
		id: 'editor.changeLanguage',
		title: 'Change Language Mode…',
		category: 'Edit',
		keywords: ['syntax', 'highlighting', 'mode'],
		run: changeLanguage,
	},
	{
		id: 'editor.indentToSpaces',
		title: 'Convert Indentation to Spaces',
		category: 'Edit',
		run: () => runEditorAction('editor.action.indentationToSpaces'),
	},
	{
		id: 'editor.indentToTabs',
		title: 'Convert Indentation to Tabs',
		category: 'Edit',
		run: () => runEditorAction('editor.action.indentationToTabs'),
	},
	{
		id: 'editor.trimWhitespace',
		title: 'Trim Trailing Whitespace',
		category: 'Edit',
		run: () => runEditorAction('editor.action.trimTrailingWhitespace'),
	},
];
