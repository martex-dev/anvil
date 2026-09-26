import type { JSX } from 'react';

/**
 * The page everything is printed on: flat paper, the cloudy formation of its fibres and a fine
 * grain from two static turbulence filters, and a deckled vignette at the edges (skin.css). Drawn once on its own
 * layer, so typing in the editor above never repaints it.
 */
export function PaperBackdrop(): JSX.Element {
	return (
		<div data-zen='paper' aria-hidden>
			<svg className='zn-paper-texture' width='100%' height='100%'>
				<filter id='zn-fibre' x='0' y='0' width='100%' height='100%'>
					<feTurbulence
						type='fractalNoise'
						baseFrequency='0.006 0.011'
						numOctaves={4}
						seed={11}
						result='noise'
					/>
					<feColorMatrix
						in='noise'
						type='matrix'
						values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.95'
						result='mask'
					/>
					<feFlood className='zn-fibre-ink' />
					<feComposite in2='mask' operator='in' />
				</filter>
				<filter id='zn-grain' x='0' y='0' width='100%' height='100%'>
					<feTurbulence
						type='fractalNoise'
						baseFrequency='0.9'
						numOctaves={2}
						seed={4}
						result='noise'
					/>
					<feColorMatrix
						in='noise'
						type='matrix'
						values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.9'
						result='mask'
					/>
					<feFlood className='zn-grain-ink' />
					<feComposite in2='mask' operator='in' />
				</filter>
				<rect width='100%' height='100%' filter='url(#zn-fibre)' />
				<rect width='100%' height='100%' filter='url(#zn-grain)' />
			</svg>
		</div>
	);
}
