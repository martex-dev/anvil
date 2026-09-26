import type { CSSProperties, JSX } from 'react';

type Spot = Record<`--${string}`, string>;

const at = (vars: Spot): CSSProperties => vars as CSSProperties;

// Fixed positions (not random) so every launch and every screenshot looks the same.
const CLOUDS: Spot[] = [
	{ '--x': '6%', '--y': '14%', '--s': '1.1', '--d': '0s' },
	{ '--x': '58%', '--y': '8%', '--s': '0.8', '--d': '-30s' },
	{ '--x': '78%', '--y': '30%', '--s': '1.3', '--d': '-55s' },
	{ '--x': '26%', '--y': '40%', '--s': '0.7', '--d': '-12s' },
];

const BUBBLES: Spot[] = [
	{ '--x': '3%', '--y': '70%', '--s': '46px', '--d': '0s' },
	{ '--x': '12%', '--y': '26%', '--s': '22px', '--d': '-3s' },
	{ '--x': '44%', '--y': '82%', '--s': '30px', '--d': '-6s' },
	{ '--x': '70%', '--y': '58%', '--s': '58px', '--d': '-2s' },
	{ '--x': '91%', '--y': '12%', '--s': '34px', '--d': '-8s' },
	{ '--x': '96%', '--y': '76%', '--s': '20px', '--d': '-5s' },
];

const SPARKLES: Spot[] = [
	{ '--x': '9%', '--y': '9%', '--s': '14px', '--d': '0s' },
	{ '--x': '35%', '--y': '4%', '--s': '9px', '--d': '-1.2s' },
	{ '--x': '52%', '--y': '30%', '--s': '12px', '--d': '-2.1s' },
	{ '--x': '83%', '--y': '6%', '--s': '16px', '--d': '-0.6s' },
	{ '--x': '97%', '--y': '44%', '--s': '10px', '--d': '-1.7s' },
	{ '--x': '1.5%', '--y': '48%', '--s': '11px', '--d': '-2.6s' },
	{ '--x': '64%', '--y': '94%', '--s': '13px', '--d': '-0.9s' },
	{ '--x': '22%', '--y': '96%', '--s': '9px', '--d': '-3.1s' },
];

/**
 * The sky behind the panes: a pastel sunset with a striped vaporwave sun, puffy clouds, soap
 * bubbles, twinkling four-point sparkles and a neon perspective grid rolling toward the horizon.
 * Motion only runs with effects on full; `subtle` freezes it and `off` leaves the bare sky.
 */
export function YkBackdrop(): JSX.Element {
	return (
		<div className='yk-backdrop' aria-hidden>
			<div className='yk-sun' />
			<div className='yk-horizon'>
				<div className='yk-plane'>
					<div className='yk-grid' />
				</div>
			</div>
			{CLOUDS.map((c, i) => (
				<span key={`c${i}`} className='yk-cloud' style={at(c)} />
			))}
			{BUBBLES.map((b, i) => (
				<span key={`b${i}`} className='yk-bubble' style={at(b)} />
			))}
			{SPARKLES.map((s, i) => (
				<span key={`s${i}`} className='yk-sparkle' style={at(s)} />
			))}
		</div>
	);
}
