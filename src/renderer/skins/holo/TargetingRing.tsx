import type { JSX } from 'react';

const TICKS = Array.from({ length: 120 }, (_, i) => i * 3);
const BEARINGS = ['000', '090', '180', '270'];

/**
 * The big targeting ring behind the panes: static range rings, a counter-rotating bearing
 * scale, a slowly turning arc set and a radar sweep. Each moving part is its own HTML layer
 * so rotation stays on the compositor (SVG transforms would repaint).
 */
export function TargetingRing(): JSX.Element {
	return (
		<div className='ho-radar' aria-hidden>
			<svg className='ho-radar-layer' viewBox='-500 -500 1000 1000'>
				<circle r='470' className='ho-ring ho-ring-faint' />
				<circle r='300' className='ho-ring ho-ring-dash' />
				<circle r='180' className='ho-ring' />
				<circle r='60' className='ho-ring ho-ring-faint' />
				<path d='M-500 0H-200M200 0H500M0 -500V-200M0 200V500' className='ho-ring' />
				<path d='M-14 0H14M0 -14V14' className='ho-ring ho-ring-hot' />
			</svg>
			<div className='ho-radar-layer ho-spin-rev'>
				<svg viewBox='-500 -500 1000 1000'>
					{TICKS.map((deg) => (
						<line
							key={deg}
							y1={-430}
							y2={deg % 30 === 0 ? -408 : -420}
							transform={`rotate(${deg})`}
							className={deg % 30 === 0 ? 'ho-ring ho-ring-hot' : 'ho-ring'}
						/>
					))}
					{BEARINGS.map((label, i) => (
						<text
							key={label}
							y={-386}
							transform={`rotate(${i * 90})`}
							textAnchor='middle'
							className='ho-ring-label'
						>
							{label}
						</text>
					))}
				</svg>
			</div>
			<div className='ho-radar-layer ho-spin'>
				<svg viewBox='-500 -500 1000 1000'>
					<circle r='360' className='ho-ring ho-ring-arcs' />
					<circle r='240' className='ho-ring ho-ring-arcs-sm' />
				</svg>
			</div>
			<div className='ho-radar-layer ho-sweep' />
		</div>
	);
}
