import type { ComponentType } from 'react';

import type { ChromeIconName, IconProps, IconSet } from '../types';
import { Glyph } from './Glyph';

/** The character each chrome icon becomes: ASCII first, a few CP437-style symbols where apt. */
const GLYPHS: Record<ChromeIconName, string> = {
	explorer: '≡',
	search: '/',
	git: '±',
	run: '▶',
	outline: '§',
	todos: '!',
	history: '↺',
	snippets: '{}',
	toolbox: '%',
	ai: '@',
	settings: '*',
	terminal: '$',
	problems: '‼',
	play: '▶',
	close: 'x',
	plus: '+',
	split: '║',
	menu: '≡',
	sidebar: '▌',
	panel: '▄',
	minimize: '_',
	maximize: '□',
	restore: '▫',
	palette: ':',
};

function glyphIcon(char: string): ComponentType<IconProps> {
	const Icon = ({ size, className }: IconProps): ReturnType<typeof Glyph> => (
		<Glyph char={char} size={size} className={className} />
	);
	Icon.displayName = `MainframeGlyph(${char})`;
	return Icon;
}

const icons: IconSet = Object.fromEntries(
	Object.entries(GLYPHS).map(([name, char]) => [name, glyphIcon(char)]),
);

export default icons;
