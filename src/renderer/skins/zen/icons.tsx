import type { JSX, ReactNode } from 'react';

import type { ChromeIconName, IconProps, IconSet } from '../types';

/**
 * Hairline ink drawings on a 24px grid: an open book for files, an ensō for the assistant, a
 * calligraphy brush for tools, an ink drop for colors. One weight everywhere, round ends, no
 * fills, so they sit next to serif type like marginalia rather than app icons.
 */
const DRAWINGS: Record<ChromeIconName, ReactNode> = {
	explorer: (
		<>
			<path d='M12 6.6C9.8 5.1 6.9 4.7 4 5.3v12.4c2.9-.6 5.8-.2 8 1.3 2.2-1.5 5.1-1.9 8-1.3V5.3c-2.9-.6-5.8-.2-8 1.3z' />
			<path d='M12 6.6V19' />
		</>
	),
	search: (
		<>
			<circle cx='10.5' cy='10.5' r='5.6' />
			<path d='M14.6 14.6 19.6 19.6' />
		</>
	),
	git: (
		<>
			<circle cx='7' cy='5.4' r='1.6' />
			<circle cx='7' cy='18.6' r='1.6' />
			<circle cx='17' cy='8' r='1.6' />
			<path d='M7 7v10' />
			<path d='M17 9.6c0 4.2-10 2.8-10 7.4' />
		</>
	),
	run: <path d='M8 5.5 18.5 12 8 18.5z' />,
	outline: <path d='M5 6h14M8 10h11M8 14h8M11 18h8' />,
	todos: (
		<>
			<path d='m4.5 7.2 1.6 1.6 3-3.3M12 7h8' />
			<path d='m4.5 15.2 1.6 1.6 3-3.3M12 15h8' />
		</>
	),
	history: (
		<>
			<path d='M7 4h10M7 20h10' />
			<path d='M8.2 4c0 4.6 7.6 4.4 7.6 8s-7.6 3.4-7.6 8M15.8 4c0 4.6-7.6 4.4-7.6 8s7.6 3.4 7.6 8' />
		</>
	),
	snippets: (
		<>
			<path d='M6 3.8h8.2L18 7.6v12.6H6z' />
			<path d='M14.2 3.8v3.8H18M9 12h6M9 15.5h4' />
		</>
	),
	toolbox: (
		<>
			<path d='M19.5 4.5 11 13' />
			<path d='M11 13c-2.1-.3-4 1.2-4.2 3.2-.1 1.5-.9 2.6-2.3 3.3 3.4.9 7.3-.1 7.9-3.3z' />
		</>
	),
	ai: (
		<>
			<path d='M17.2 5.4a8 8 0 1 0 2.6 6.9' />
			<path d='M19.8 12.3c.2-1.2 0-2.4-.5-3.4' />
		</>
	),
	settings: (
		<>
			<circle cx='12' cy='12' r='3' />
			<path d='M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9 18 18M6 18l2.1-2.1M15.9 8.1 18 6' />
		</>
	),
	terminal: <path d='m5 7.5 4.5 4.5L5 16.5M12 16.5h7' />,
	problems: (
		<>
			<circle cx='12' cy='12' r='8' />
			<path d='M12 7.8v5.4M12 16.1v.1' />
		</>
	),
	play: <path d='M8 5.5 18.5 12 8 18.5z' />,
	close: <path d='m6.5 6.5 11 11M17.5 6.5l-11 11' />,
	plus: <path d='M12 5v14M5 12h14' />,
	split: (
		<>
			<rect x='4' y='5' width='16' height='14' />
			<path d='M12 5v14' />
		</>
	),
	menu: <path d='M5 8h14M5 12h14M5 16h9' />,
	sidebar: (
		<>
			<rect x='4' y='5' width='16' height='14' />
			<path d='M9.5 5v14' />
		</>
	),
	panel: (
		<>
			<rect x='4' y='5' width='16' height='14' />
			<path d='M4 14.5h16' />
		</>
	),
	minimize: <path d='M6 12h12' />,
	maximize: <rect x='6.5' y='6.5' width='11' height='11' />,
	restore: (
		<>
			<rect x='6' y='9' width='9' height='9' />
			<path d='M9 9V6h9v9h-3' />
		</>
	),
	palette: (
		<path d='M12 3.8c3.2 4.2 5.6 7.2 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-3.2 2.4-6.2 5.6-10.4z' />
	),
};

function draw(name: ChromeIconName): (props: IconProps) => JSX.Element {
	function Drawing({ size, className }: IconProps): JSX.Element {
		return (
			<svg
				aria-hidden
				width={size}
				height={size}
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth={1.15}
				strokeLinecap='round'
				strokeLinejoin='round'
				className={className}
			>
				{DRAWINGS[name]}
			</svg>
		);
	}
	Drawing.displayName = `ZenIcon(${name})`;
	return Drawing;
}

const icons: IconSet = Object.fromEntries(
	(Object.keys(DRAWINGS) as ChromeIconName[]).map((name) => [name, draw(name)]),
);

export default icons;
