import { Layers, Palette, Sparkles, SwatchBook } from 'lucide-react';

import type { Command } from '../../app/commands/types';
import {
	cycleAccent,
	cycleEffects,
	nextSkin,
	nextTheme,
	pickSkin,
	pickTheme,
} from './theme-picker';

export const APPEARANCE_COMMANDS: Command[] = [
	{
		id: 'anvil.skin',
		title: 'Skin…',
		category: 'Anvil',
		shortcut: 'Ctrl+Alt+Y',
		icon: Layers,
		keywords: ['theme', 'look', 'layout', 'appearance', 'retro', 'terminal', 'brutalist'],
		run: pickSkin,
	},
	{
		id: 'anvil.nextSkin',
		title: 'Next Skin',
		category: 'Anvil',
		run: nextSkin,
	},
	{
		id: 'anvil.theme',
		title: 'Color Variant…',
		category: 'Anvil',
		shortcut: 'Ctrl+Alt+T',
		icon: SwatchBook,
		keywords: ['theme', 'palette', 'dark', 'light', 'colors', 'appearance'],
		run: pickTheme,
	},
	{
		id: 'anvil.nextTheme',
		title: 'Next Color Variant',
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
		id: 'anvil.effects',
		title: 'Cycle Effects (full / subtle / off)',
		category: 'Anvil',
		icon: Sparkles,
		keywords: ['scanlines', 'glow', 'animation', 'performance'],
		run: cycleEffects,
	},
];
