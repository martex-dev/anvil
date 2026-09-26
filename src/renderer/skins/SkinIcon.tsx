import {
	Blocks,
	Bot,
	CircleAlert,
	Columns2,
	Copy,
	Files,
	GitBranch,
	History,
	ListTodo,
	ListTree,
	type LucideIcon,
	Menu,
	Minus,
	Palette,
	PanelBottom,
	PanelLeft,
	Play,
	Plus,
	Search,
	Settings,
	Square,
	SquareTerminal,
	Wrench,
	X,
} from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../lib/cn';
import { iconsFor } from './chrome-registry';
import { useLook } from './look-store';
import type { ChromeIconName } from './types';

const DEFAULT_ICONS: Record<ChromeIconName, LucideIcon> = {
	explorer: Files,
	search: Search,
	git: GitBranch,
	run: Play,
	outline: ListTree,
	todos: ListTodo,
	history: History,
	snippets: Blocks,
	toolbox: Wrench,
	ai: Bot,
	settings: Settings,
	terminal: SquareTerminal,
	problems: CircleAlert,
	play: Play,
	close: X,
	plus: Plus,
	split: Columns2,
	menu: Menu,
	sidebar: PanelLeft,
	panel: PanelBottom,
	minimize: Minus,
	maximize: Square,
	restore: Copy,
	palette: Palette,
};

/**
 * A chrome icon in the active skin's style: the skin's own drawing when it has one (pixel art,
 * text glyphs), otherwise lucide, whose stroke the skin restyles in CSS.
 */
export function SkinIcon({
	name,
	size = 16,
	className,
}: {
	name: ChromeIconName;
	size?: number;
	className?: string;
}): JSX.Element {
	const { skin } = useLook();
	const Custom = iconsFor(skin.id)[name];
	if (Custom) return <Custom size={size} className={cn('skin-icon', className)} />;
	const Icon = DEFAULT_ICONS[name];
	return <Icon size={size} strokeWidth={1.75} className={cn('skin-icon', className)} />;
}
