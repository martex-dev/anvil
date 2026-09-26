import type { ComponentType, JSX } from 'react';

/**
 * A hover-reveal views bar for skins that keep the screen empty: a thin strip at the left edge
 * slides the activity bar in while the pointer or keyboard focus is inside it.
 */
export function ActivityRail({ Bar }: { Bar: ComponentType }): JSX.Element {
	return (
		<div
			data-part='activity-rail'
			className='group/rail absolute inset-y-0 left-0 z-30 w-3 focus-within:w-auto hover:w-auto'
		>
			<div className='h-full -translate-x-[calc(100%+8px)] py-2 pl-1.5 transition-transform transition-base group-focus-within/rail:translate-x-0 group-hover/rail:translate-x-0'>
				<Bar />
			</div>
		</div>
	);
}
