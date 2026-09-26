import type { JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { Tooltip } from '../../ui/Tooltip';
import { SkinIcon } from '../SkinIcon';
import type { ChromeIconName } from '../types';

export interface NavTabProps {
	label: string;
	short: string;
	command: string;
	icon: ChromeIconName;
	active: boolean;
	onClick: () => void;
	code: string;
	index?: number;
	badge?: number;
}

/** One views-switcher key: an angled chevron plate with a system code, glyph and label. */
export function NavTab({
	label,
	short,
	command,
	icon,
	active,
	onClick,
	code,
	index,
	badge,
}: NavTabProps): JSX.Element {
	return (
		<Tooltip content={label} shortcut={shortcutFor(command)} side='bottom'>
			<button
				type='button'
				aria-label={label}
				aria-pressed={active}
				data-part='activity-item'
				data-view={icon}
				data-index={index}
				data-active={active}
				onClick={onClick}
				className='ho-navtab'
			>
				<span className='ho-navtab-code' aria-hidden>
					{code}
				</span>
				<SkinIcon name={icon} size={18} />
				<span data-part='activity-label' className='ho-navtab-label'>
					{short}
				</span>
				{badge !== undefined && badge > 0 && (
					<span data-part='activity-badge' className='ho-navtab-badge num'>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</button>
		</Tooltip>
	);
}
