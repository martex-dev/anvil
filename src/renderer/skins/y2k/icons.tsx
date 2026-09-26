import type { ComponentType, JSX } from 'react';

import { CHROME_ICONS, type ChromeIconName, type IconProps, type IconSet } from '../types';
import { Glyph } from './Glyph';

// Bodies get a translucent candy fill so the shapes feel molded, not outlined.
const CANDY = { fill: 'currentColor', fillOpacity: 0.22 } as const;
const SOLID = { fill: 'currentColor', stroke: 'none' } as const;

/** A short white arc on round bodies: the specular highlight of a plastic bubble. */
const shine = (d: string): JSX.Element => <path className='yk-shine' d={d} strokeWidth={1.6} />;

const DRAW: Record<ChromeIconName, JSX.Element> = {
	explorer: (
		<>
			<path
				{...CANDY}
				d='M3 8.5A2.5 2.5 0 0 1 5.5 6H9l2 2h7.5A2.5 2.5 0 0 1 21 10.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z'
			/>
			{shine('M6.5 11.5h5')}
		</>
	),
	search: (
		<>
			<circle {...CANDY} cx='10.5' cy='10.5' r='6.5' />
			<path d='M15.6 15.6l4.6 4.6' strokeWidth={3.2} />
			{shine('M7.6 9.2a3.3 3.3 0 0 1 2.4-2.3')}
		</>
	),
	git: (
		<>
			<path d='M6 7.8v8.4M18 10.8c0 3.6-3.2 5-9.4 6.3' />
			<circle {...CANDY} cx='6' cy='5.2' r='2.6' />
			<circle {...CANDY} cx='6' cy='18.8' r='2.6' />
			<circle {...CANDY} cx='18' cy='8.2' r='2.6' />
		</>
	),
	run: (
		<>
			<circle {...CANDY} cx='12' cy='12' r='9' />
			<path
				{...SOLID}
				d='M10 8.3v7.4a.9.9 0 0 0 1.4.8l5.6-3.7a.9.9 0 0 0 0-1.6l-5.6-3.7a.9.9 0 0 0-1.4.8z'
			/>
			{shine('M6.4 9.6a6 6 0 0 1 3-3.4')}
		</>
	),
	outline: (
		<>
			<circle {...SOLID} cx='5' cy='6' r='1.9' />
			<circle {...SOLID} cx='5' cy='12' r='1.9' />
			<circle {...SOLID} cx='5' cy='18' r='1.9' />
			<path d='M10 6h10M10 12h10M10 18h7' />
		</>
	),
	todos: (
		<>
			<rect {...CANDY} x='3.5' y='3.5' width='17' height='17' rx='5.5' />
			<path d='M8 12.5l3 3 5.5-6.2' strokeWidth={2.6} />
		</>
	),
	history: (
		<>
			<circle {...CANDY} cx='12' cy='12' r='8.8' />
			<path d='M12 7.4V12l3.2 2' />
			{shine('M6.3 10a6 6 0 0 1 3.2-3.8')}
		</>
	),
	snippets: (
		<>
			<rect {...CANDY} x='3' y='3' width='8' height='8' rx='2.6' />
			<rect {...CANDY} x='13' y='3' width='8' height='8' rx='2.6' />
			<rect {...CANDY} x='3' y='13' width='8' height='8' rx='2.6' />
			<circle {...CANDY} cx='17' cy='17' r='4' />
		</>
	),
	toolbox: (
		<>
			<path d='M9 8V6.4A2.4 2.4 0 0 1 11.4 4h1.2A2.4 2.4 0 0 1 15 6.4V8' />
			<rect {...CANDY} x='3' y='8' width='18' height='12' rx='3.5' />
			<path d='M3 13.4h18M10.5 13.4v2h3v-2' />
		</>
	),
	ai: (
		<>
			<path
				{...CANDY}
				fillOpacity={0.3}
				d='M10.5 3c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7z'
			/>
			<path
				{...SOLID}
				d='M18.6 14.6c.25 1.3.9 1.95 2.2 2.2-1.3.25-1.95.9-2.2 2.2-.25-1.3-.9-1.95-2.2-2.2 1.3-.25 1.95-.9 2.2-2.2z'
			/>
		</>
	),
	settings: (
		<>
			<circle
				cx='12'
				cy='12'
				r='8'
				strokeWidth={3.4}
				strokeLinecap='butt'
				strokeDasharray='3.1 3.18'
			/>
			<circle {...CANDY} cx='12' cy='12' r='5.6' />
			<circle cx='12' cy='12' r='1.9' />
		</>
	),
	terminal: (
		<>
			<rect {...CANDY} x='2.8' y='4.5' width='18.4' height='15' rx='4' />
			<path d='M7.2 10l3 2.5-3 2.5M13 15.5h4' />
		</>
	),
	problems: (
		<>
			<circle {...CANDY} cx='12' cy='12' r='8.8' />
			<path d='M12 7.4v5.4' strokeWidth={2.6} />
			<circle {...SOLID} cx='12' cy='16.4' r='1.5' />
		</>
	),
	play: (
		<path
			{...CANDY}
			fillOpacity={0.5}
			d='M7.5 5.4v13.2a1.3 1.3 0 0 0 2 1.1l10-6.6a1.3 1.3 0 0 0 0-2.2l-10-6.6a1.3 1.3 0 0 0-2 1.1z'
		/>
	),
	close: <path d='M6.8 6.8l10.4 10.4M17.2 6.8L6.8 17.2' strokeWidth={2.8} />,
	plus: <path d='M12 5.2v13.6M5.2 12h13.6' strokeWidth={2.8} />,
	split: (
		<>
			<rect {...CANDY} x='3' y='4' width='18' height='16' rx='4' />
			<path d='M12 4v16' />
		</>
	),
	menu: <path d='M4.5 7h15M4.5 12h15M4.5 17h15' strokeWidth={2.6} />,
	sidebar: (
		<>
			<rect x='3' y='4' width='18' height='16' rx='4' />
			<path {...CANDY} fillOpacity={0.4} d='M7 4h3v16H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z' />
			<path d='M10 4v16' />
		</>
	),
	panel: (
		<>
			<rect x='3' y='4' width='18' height='16' rx='4' />
			<path {...CANDY} fillOpacity={0.4} d='M3 14h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z' />
			<path d='M3 14h18' />
		</>
	),
	minimize: <path d='M6 12h12' strokeWidth={2.8} />,
	maximize: <rect x='5.5' y='5.5' width='13' height='13' rx='3.5' strokeWidth={2.6} />,
	restore: (
		<>
			<rect x='4.5' y='9' width='10.5' height='10.5' rx='3' strokeWidth={2.4} />
			<path
				d='M9 9V7.6A2.6 2.6 0 0 1 11.6 5h4.8A2.6 2.6 0 0 1 19 7.6v4.8a2.6 2.6 0 0 1-2.6 2.6H15'
				strokeWidth={2.4}
			/>
		</>
	),
	palette: (
		<>
			<path
				{...CANDY}
				d='M12 3a9 9 0 1 0 0 18c1.3 0 2-.9 2-1.9 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z'
			/>
			<circle {...SOLID} cx='7.5' cy='11' r='1.4' />
			<circle {...SOLID} cx='9.6' cy='7' r='1.4' />
			<circle {...SOLID} cx='14.4' cy='7' r='1.4' />
			<circle {...SOLID} cx='17' cy='10.6' r='1.4' />
		</>
	),
};

function iconFor(name: ChromeIconName): ComponentType<IconProps> {
	function YkIcon({ size, className }: IconProps): JSX.Element {
		return (
			<Glyph size={size} className={className}>
				{DRAW[name]}
			</Glyph>
		);
	}
	YkIcon.displayName = `YkIcon(${name})`;
	return YkIcon;
}

const icons: IconSet = Object.fromEntries(CHROME_ICONS.map((name) => [name, iconFor(name)]));

export default icons;
