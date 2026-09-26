import type { ComponentType, JSX } from 'react';

import type { ChromeIconName, IconProps, IconSet } from '../types';
import {
	CLOSE,
	MAXIMIZE,
	MENU,
	MINIMIZE,
	PANEL,
	PLUS,
	RESTORE,
	SIDEBAR,
	SPLIT,
} from './art-glyphs';
import { PAINT, PLAY, PROMPT, ROBOT, SLIDERS, WARNING } from './art-tools';
import {
	BLOCKS,
	BRANCH,
	CHECKLIST,
	CLOCK,
	FOLDER,
	MAGNIFIER,
	PROGRAM,
	TOOLBOX,
	TREE,
} from './art-views';
import type { PixelArt } from './pixel';
import { PixelIcon } from './PixelIcon';

/** Which drawing stands for each chrome icon. */
export const CHROME_ART: Record<ChromeIconName, PixelArt> = {
	explorer: FOLDER,
	search: MAGNIFIER,
	git: BRANCH,
	run: PROGRAM,
	outline: TREE,
	todos: CHECKLIST,
	history: CLOCK,
	snippets: BLOCKS,
	toolbox: TOOLBOX,
	ai: ROBOT,
	settings: SLIDERS,
	terminal: PROMPT,
	problems: WARNING,
	play: PLAY,
	close: CLOSE,
	plus: PLUS,
	split: SPLIT,
	menu: MENU,
	sidebar: SIDEBAR,
	panel: PANEL,
	minimize: MINIMIZE,
	maximize: MAXIMIZE,
	restore: RESTORE,
	palette: PAINT,
};

function iconFor(art: PixelArt): ComponentType<IconProps> {
	return function WorkbenchIcon({ size, className }: IconProps): JSX.Element {
		return <PixelIcon art={art} size={size} className={className} />;
	};
}

const icons: IconSet = Object.fromEntries(
	Object.entries(CHROME_ART).map(([name, art]) => [name, iconFor(art)]),
);

export default icons;
