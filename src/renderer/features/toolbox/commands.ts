import type { Command } from '../../app/commands/types';
import { TOOLS } from './tool-list';
import { openTool } from './toolbox-store';

/** One palette entry per tool ("Toolbox: JWT Decoder"), so no tool needs a hunt through tabs. */
export const TOOLBOX_COMMANDS: Command[] = TOOLS.map((tool) => ({
	id: `toolbox.${tool.id}`,
	title: `Toolbox: ${tool.title}`,
	category: 'Tools' as const,
	icon: tool.icon,
	keywords: ['toolbox', tool.label.toLowerCase(), ...tool.hint.toLowerCase().split(/[\s,/]+/)],
	run: () => openTool(tool.id),
}));
