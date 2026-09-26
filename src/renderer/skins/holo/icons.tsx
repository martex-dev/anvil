import type { ComponentType } from 'react';

import type { ChromeIconName, IconProps, IconSet } from '../types';
import { type GlyphFrame, HoloGlyph } from './HoloGlyph';

/** Glyph path and frame per icon; views sit in hexagons, the AI core in a diamond. */
const GLYPHS: Record<ChromeIconName, [string, GlyphFrame]> = {
	explorer: ['M8 7h5l3 3v7H8ZM13 7v3h3M10 13h4', 'hex'],
	search: ['M11.2 7.4a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 1 0 0-7.6ZM14 14l2.8 2.8M11.2 9.8v.8', 'hex'],
	git: ['M9 7.6v8.8M15 9.4v1.4l-6 3.6M7.8 17.6h2.4v-2.4H7.8ZM13.8 9.4h2.4V7H13.8Z', 'hex'],
	run: ['M9.5 7.5v9l7-4.5Z', 'hex'],
	outline: ['M7.5 8h1.5M11 8h5.5M9.5 12H11M13 12h3.5M11.5 16H13M15 16h1.5', 'hex'],
	todos: ['M7.5 8.4l1.4 1.4 2.4-2.6M13 8.8h3.5M7.5 13.5h3v3h-3ZM13 15h3.5', 'hex'],
	history: ['M12 7.2a4.8 4.8 0 1 0 4.8 4.8M16.8 12V8.6M12 9.5V12l2 1.5', 'hex'],
	snippets: ['M10.5 7.5H9v3L7.5 12 9 13.5v3h1.5M13.5 7.5H15v3l1.5 1.5-1.5 1.5v3h-1.5', 'hex'],
	toolbox: ['M12 7l4.5 2.5v5L12 17l-4.5-2.5v-5ZM7.5 9.5 12 12l4.5-2.5M12 12v5', 'hex'],
	ai: ['M12 7.2l1.3 3.5 3.5 1.3-3.5 1.3L12 16.8l-1.3-3.5L7.2 12l3.5-1.3Z', 'diamond'],
	settings: ['M12 8l3.5 2v4L12 16l-3.5-2v-4ZM12 11.2v1.6', 'hex'],
	terminal: ['M8 9.5l2.5 2.5L8 14.5M12.5 15H16', 'hex'],
	problems: ['M12 9v5.5M12 16.5v1.2', 'triangle'],
	play: ['M7 5v14l11-7Z', 'none'],
	close: ['M6.5 6.5l11 11M17.5 6.5l-11 11', 'none'],
	plus: ['M12 5v14M5 12h14', 'none'],
	split: ['M6.5 5H20v11.5L17.5 19H4V7.5ZM12 5v14', 'none'],
	menu: ['M4 7h16M4 12h11M4 17h7', 'none'],
	sidebar: ['M6.5 5H20v11.5L17.5 19H4V7.5ZM9.5 5v14', 'none'],
	panel: ['M6.5 5H20v11.5L17.5 19H4V7.5ZM4 14h16', 'none'],
	minimize: ['M6 12h12', 'none'],
	maximize: ['M8.5 6H18v9.5L15.5 18H6V8.5Z', 'none'],
	restore: ['M9.5 9H16v6.5L14 17.5H7.5V11ZM10 6h8v8', 'none'],
	palette: ['M12 7l4.5 2.5v5L12 17l-4.5-2.5v-5ZM12 7v10M7.5 9.5l9 5M16.5 9.5l-9 5', 'hex'],
};

const glyph = (name: ChromeIconName): ComponentType<IconProps> => {
	const [d, frame] = GLYPHS[name];
	const Icon = (props: IconProps): ReturnType<typeof HoloGlyph> => (
		<HoloGlyph d={d} frame={frame} {...props} />
	);
	Icon.displayName = `HoloIcon(${name})`;
	return Icon;
};

const icons: IconSet = Object.fromEntries(
	(Object.keys(GLYPHS) as ChromeIconName[]).map((name) => [name, glyph(name)]),
);

export default icons;
