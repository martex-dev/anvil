import { AI_COMMANDS } from '../../features/ai/commands';
import { DATA_COMMANDS } from '../../features/data/commands';
import { EDITOR_COMMANDS } from '../../features/editor/commands';
import { GIT_COMMANDS } from '../../features/git/commands';
import { PYTHON_COMMANDS } from '../../features/python/commands';
import { TERMINAL_COMMANDS } from '../../features/terminal/commands';
import { TOOL_COMMANDS } from '../../features/tools/commands';
import { CORE_COMMANDS } from './core-commands';
import { setCommands } from './run';
import type { Command } from './types';

/** Every command in the app: the palette, menus, shortcuts and Monaco actions all read this. */
export const ALL_COMMANDS: readonly Command[] = [
	...CORE_COMMANDS,
	...EDITOR_COMMANDS,
	...PYTHON_COMMANDS,
	...DATA_COMMANDS,
	...AI_COMMANDS,
	...GIT_COMMANDS,
	...TERMINAL_COMMANDS,
	...TOOL_COMMANDS,
];

setCommands(ALL_COMMANDS);
