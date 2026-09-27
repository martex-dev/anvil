import {
	Bug,
	ListRestart,
	Play,
	RefreshCw,
	RotateCw,
	ScrollText,
	Square,
	TestTube,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { revealTests, runCurrentFileTests, runTestAtCursor } from './editor-actions';
import {
	cancelTests,
	discoverTests,
	rerunLastTests,
	runFailedTests,
	runTests,
	showTestOutput,
} from './tests-store';

const KEYWORDS = ['pytest', 'test', 'unit test'];

/**
 * The Test Explorer's commands. Palette-only except Run Test at Cursor, which takes PyCharm's
 * "run the thing under the cursor" key (Ctrl+Shift+F10) in Python editors.
 */
export const TESTS_COMMANDS: Command[] = [
	{
		id: 'tests.runAll',
		title: 'Test: Run All Tests',
		category: 'Run',
		keywords: KEYWORDS,
		icon: Play,
		run: () => {
			revealTests();
			return runTests();
		},
	},
	{
		id: 'tests.runFailed',
		title: 'Test: Run Failed Tests',
		category: 'Run',
		keywords: KEYWORDS,
		icon: ListRestart,
		run: () => {
			revealTests();
			return runFailedTests();
		},
	},
	{
		id: 'tests.runFile',
		title: 'Test: Run Tests in Current File',
		category: 'Run',
		keywords: KEYWORDS,
		icon: TestTube,
		run: runCurrentFileTests,
	},
	{
		id: 'tests.runAtCursor',
		title: 'Test: Run Test at Cursor',
		category: 'Run',
		shortcut: 'Ctrl+Shift+F10',
		scope: 'editor',
		editorLanguage: 'python',
		keywords: KEYWORDS,
		icon: Play,
		run: () => runTestAtCursor(false),
	},
	{
		id: 'tests.debugAtCursor',
		title: 'Test: Debug Test at Cursor (pdb)',
		category: 'Run',
		keywords: [...KEYWORDS, 'pdb', 'debugger'],
		icon: Bug,
		run: () => runTestAtCursor(true),
	},
	{
		id: 'tests.rerunLast',
		title: 'Test: Re-run Last Tests',
		category: 'Run',
		keywords: KEYWORDS,
		icon: RotateCw,
		run: rerunLastTests,
	},
	{
		id: 'tests.cancel',
		title: 'Test: Stop Test Run',
		category: 'Run',
		keywords: KEYWORDS,
		icon: Square,
		run: cancelTests,
	},
	{
		id: 'tests.refresh',
		title: 'Test: Refresh Tests',
		category: 'Run',
		keywords: [...KEYWORDS, 'discover', 'collect'],
		icon: RefreshCw,
		run: () => {
			revealTests();
			return discoverTests();
		},
	},
	{
		id: 'tests.showOutput',
		title: 'Test: Show Test Output',
		category: 'Run',
		keywords: [...KEYWORDS, 'log', 'console'],
		icon: ScrollText,
		run: showTestOutput,
	},
];
