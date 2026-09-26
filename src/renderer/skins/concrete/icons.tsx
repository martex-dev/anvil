import type { ComponentType, JSX } from 'react';

import type { IconProps, IconSet } from '../types';

/**
 * Concrete's chrome icons: thick 3px strokes, square caps, mitred corners and solid fills,
 * drawn like pictograms on a transit poster rather than hairline UI glyphs.
 */
function make(name: string, body: JSX.Element): ComponentType<IconProps> {
	function Icon({ size, className }: IconProps): JSX.Element {
		return (
			<svg
				width={size}
				height={size}
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth={3}
				strokeLinecap='square'
				strokeLinejoin='miter'
				className={className}
				aria-hidden
			>
				{body}
			</svg>
		);
	}
	Icon.displayName = `ConcreteIcon(${name})`;
	return Icon;
}

const solid = { fill: 'currentColor', stroke: 'none' } as const;
const play = <path d='M6 3.5 20.5 12 6 20.5z' {...solid} />;

const icons: IconSet = {
	explorer: make(
		'explorer',
		<>
			<path d='M5 3h9l5 5v13H5z' />
			<path d='M14 3v5h5' />
		</>,
	),
	search: make(
		'search',
		<>
			<rect x='3.5' y='3.5' width='12' height='12' />
			<path d='M16 16l5 5' />
		</>,
	),
	git: make(
		'git',
		<>
			<path d='M6 3v12' />
			<path d='M18 9v4H6' />
			<rect x='3' y='16' width='6' height='6' {...solid} />
			<rect x='15' y='2' width='6' height='6' {...solid} />
		</>,
	),
	run: make('run', play),
	play: make('play', play),
	outline: make(
		'outline',
		<>
			<rect x='2' y='3.5' width='4' height='4' {...solid} />
			<rect x='2' y='10' width='4' height='4' {...solid} />
			<rect x='2' y='16.5' width='4' height='4' {...solid} />
			<path d='M10 5.5h12M10 12h9M10 18.5h12' />
		</>,
	),
	todos: make(
		'todos',
		<>
			<rect x='3' y='3' width='7' height='7' />
			<path d='M13 6.5h8M13 17.5h8' />
			<rect x='3' y='14' width='7' height='7' {...solid} />
		</>,
	),
	history: make(
		'history',
		<>
			<circle cx='12' cy='12' r='9' />
			<path d='M12 7v5h5' />
		</>,
	),
	snippets: make(
		'snippets',
		<>
			<path d='M8 3H5v18h3' />
			<path d='M16 3h3v18h-3' />
			<path d='M10 12h4' />
		</>,
	),
	toolbox: make(
		'toolbox',
		<>
			<rect x='3' y='8' width='18' height='12' />
			<path d='M8 8V4h8v4M3 13h18' />
		</>,
	),
	ai: make(
		'ai',
		<path d='M12 1.5 14.6 9.4 22.5 12l-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z' {...solid} />,
	),
	settings: make(
		'settings',
		<>
			<path d='M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1' />
			<rect x='8' y='8' width='8' height='8' {...solid} />
		</>,
	),
	terminal: make(
		'terminal',
		<>
			<rect x='2.5' y='4' width='19' height='16' />
			<path d='M6.5 9l3 3-3 3M12 15.5h5' />
		</>,
	),
	problems: make(
		'problems',
		<>
			<path d='M12 3 22 20.5H2z' />
			<path d='M12 10v4M12 17.2v.3' />
		</>,
	),
	close: make('close', <path d='M5 5l14 14M19 5 5 19' />),
	plus: make('plus', <path d='M12 3v18M3 12h18' />),
	split: make(
		'split',
		<>
			<rect x='2.5' y='4' width='19' height='16' />
			<path d='M12 4v16' />
		</>,
	),
	menu: make('menu', <path d='M3 5h18M3 12h18M3 19h18' />),
	sidebar: make(
		'sidebar',
		<>
			<rect x='2.5' y='4' width='19' height='16' />
			<rect x='14' y='4' width='7.5' height='16' {...solid} />
		</>,
	),
	panel: make(
		'panel',
		<>
			<rect x='2.5' y='4' width='19' height='16' />
			<rect x='2.5' y='13' width='19' height='7' {...solid} />
		</>,
	),
	minimize: make('minimize', <path d='M4 12h16' />),
	maximize: make('maximize', <rect x='4.5' y='4.5' width='15' height='15' />),
	restore: make(
		'restore',
		<>
			<rect x='3.5' y='8.5' width='12' height='12' />
			<path d='M8.5 8.5v-5h12v12h-5' />
		</>,
	),
	palette: make(
		'palette',
		<>
			<rect x='3' y='3' width='8' height='8' {...solid} />
			<rect x='13' y='3' width='8' height='8' />
			<rect x='3' y='13' width='8' height='8' />
			<rect x='13' y='13' width='8' height='8' {...solid} />
		</>,
	),
};

export default icons;
