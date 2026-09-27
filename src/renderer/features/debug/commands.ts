import {
	ArrowDownToDot,
	ArrowRightToLine,
	ArrowUpFromDot,
	Bug,
	CircleDot,
	Diamond,
	Pause,
	Play,
	RotateCcw,
	Square,
	SquareTerminal,
	Trash2,
} from 'lucide-react';

import { setContextSource } from '../../app/commands/run';
import type { Command } from '../../app/commands/types';
import { getSettings, updateSettings } from '../../app/hooks/use-settings';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { editBreakpointAtCursor, toggleBreakpointAtCursor } from './breakpoint-actions';
import { useBreakpoints } from './breakpoints';
import { isDebugging } from './debug-reducer';
import { debugState } from './debug-store';
import { control, restartDebugging, startDebugging, stopDebugging } from './session';
import { fileTarget, moduleTarget, testTarget } from './targets';

// While a session is live, F5, F10, F11 and friends drive it (see Command.when).
setContextSource('debugging', () => isDebugging(debugState()));

const start = async (target: ReturnType<typeof fileTarget>): Promise<void> => {
	if (target) await startDebugging(target);
};

/** Stepping keys do nothing useful outside a pause; say why instead of failing silently. */
const whenPaused = (run: () => Promise<void>) => async (): Promise<void> => {
	const { status } = debugState();
	if (status === 'idle') toast.info('Not debugging', 'Start with Debug Python File (Shift+F9).');
	else if (status !== 'paused')
		toast.info('The program is running', 'It has to be paused first.');
	else await run();
};

const python = { scope: 'editor', editorLanguage: 'python' } as const;

export const DEBUG_COMMANDS: Command[] = [
	{
		id: 'debug.start',
		title: 'Debug Python File',
		category: 'Run',
		shortcut: 'Shift+F9',
		keywords: ['debugger', 'debugpy', 'breakpoint'],
		icon: Bug,
		run: () => start(fileTarget()),
	},
	{
		id: 'debug.module',
		title: 'Debug File as Module (python -m)',
		category: 'Run',
		icon: Bug,
		run: () => start(moduleTarget()),
	},
	{
		id: 'debug.test',
		title: 'Debug Test at Cursor (pytest)',
		category: 'Run',
		keywords: ['pytest', 'unit test'],
		icon: Bug,
		run: () => start(testTarget()),
	},
	{
		id: 'debug.continue',
		title: 'Continue',
		category: 'Run',
		shortcut: 'F5',
		when: 'debugging',
		icon: Play,
		run: whenPaused(() => control('continue')),
	},
	{
		id: 'debug.pause',
		title: 'Pause',
		category: 'Run',
		icon: Pause,
		run: () => control('pause'),
	},
	{
		id: 'debug.stepOver',
		title: 'Step Over',
		category: 'Run',
		shortcut: 'F10',
		when: 'debugging',
		repeatable: true,
		icon: ArrowRightToLine,
		run: whenPaused(() => control('next')),
	},
	{
		id: 'debug.stepInto',
		title: 'Step Into',
		category: 'Run',
		shortcut: 'F11',
		when: 'debugging',
		repeatable: true,
		icon: ArrowDownToDot,
		run: whenPaused(() => control('stepIn')),
	},
	{
		id: 'debug.stepOut',
		title: 'Step Out',
		category: 'Run',
		shortcut: 'Shift+F11',
		when: 'debugging',
		icon: ArrowUpFromDot,
		run: whenPaused(() => control('stepOut')),
	},
	{
		id: 'debug.stop',
		title: 'Stop Debugging',
		category: 'Run',
		shortcut: 'Shift+F5',
		when: 'debugging',
		icon: Square,
		run: stopDebugging,
	},
	{
		id: 'debug.restart',
		title: 'Restart Debugging',
		category: 'Run',
		shortcut: 'Ctrl+Shift+F5',
		when: 'debugging',
		icon: RotateCcw,
		run: restartDebugging,
	},
	{
		id: 'debug.toggleBreakpoint',
		title: 'Toggle Breakpoint',
		category: 'Run',
		shortcut: 'Ctrl+F9',
		...python,
		icon: CircleDot,
		run: toggleBreakpointAtCursor,
	},
	{
		id: 'debug.conditionalBreakpoint',
		title: 'Add Conditional Breakpoint…',
		category: 'Run',
		...python,
		icon: CircleDot,
		run: () => editBreakpointAtCursor('condition'),
	},
	{
		id: 'debug.hitCountBreakpoint',
		title: 'Add Hit Count Breakpoint…',
		category: 'Run',
		...python,
		icon: CircleDot,
		run: () => editBreakpointAtCursor('hitCondition'),
	},
	{
		id: 'debug.logpoint',
		title: 'Add Logpoint…',
		category: 'Run',
		...python,
		keywords: ['tracepoint', 'print'],
		icon: Diamond,
		run: () => editBreakpointAtCursor('logMessage'),
	},
	{
		id: 'debug.removeAllBreakpoints',
		title: 'Remove All Breakpoints',
		category: 'Run',
		icon: Trash2,
		run: () => useBreakpoints.getState().clear(),
	},
	{
		id: 'debug.enableAllBreakpoints',
		title: 'Enable All Breakpoints',
		category: 'Run',
		run: () => useBreakpoints.getState().setAllEnabled(true),
	},
	{
		id: 'debug.disableAllBreakpoints',
		title: 'Disable All Breakpoints',
		category: 'Run',
		run: () => useBreakpoints.getState().setAllEnabled(false),
	},
	{
		id: 'debug.console',
		title: 'Show Debug Console',
		category: 'Run',
		keywords: ['repl', 'evaluate'],
		icon: SquareTerminal,
		run: () => useLayoutStore.getState().showPanel('debug'),
	},
	{
		id: 'debug.toggleJustMyCode',
		title: 'Toggle Debug Just My Code',
		category: 'Run',
		keywords: ['library', 'site-packages', 'step into'],
		run: async () => {
			const next = !getSettings().debugJustMyCode;
			await updateSettings({ debugJustMyCode: next });
			toast.info(
				next ? 'Debugging your code only' : 'Debugging libraries too',
				'Applies from the next debug session.',
			);
		},
	},
];
