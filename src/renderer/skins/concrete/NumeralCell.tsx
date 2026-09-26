import type { JSX, ReactNode } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { Tooltip } from '../../ui/Tooltip';

export interface NumeralCellProps {
	/** Full name, for the tooltip and screen readers. */
	label: string;
	/** The small caption under the numeral. */
	short: string;
	command: string;
	view: string;
	/** 1-9 for side views; absent for AI and settings. */
	index?: number;
	/** What sits in the numeral slot when there is no index (a glyph or a word). */
	mark?: ReactNode;
	active: boolean;
	badge?: number;
	onClick: () => void;
}

/** One entry of the numeral column: a huge index over a tiny uppercase caption. */
export function NumeralCell({
	label,
	short,
	command,
	view,
	index,
	mark,
	active,
	badge,
	onClick,
}: NumeralCellProps): JSX.Element {
	return (
		<Tooltip content={label} shortcut={shortcutFor(command)} side='left'>
			<button
				type='button'
				aria-label={label}
				aria-pressed={active}
				data-part='activity-item'
				data-view={view}
				data-index={index}
				data-active={active}
				onClick={onClick}
				className='cc-cell'
			>
				<span className='cc-cell-num' aria-hidden>
					{index !== undefined ? String(index).padStart(2, '0') : mark}
				</span>
				<span data-part='activity-label' className='cc-cell-label'>
					{short}
				</span>
				{badge !== undefined && badge > 0 && (
					<span data-part='activity-badge' className='cc-cell-badge num'>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</button>
		</Tooltip>
	);
}
