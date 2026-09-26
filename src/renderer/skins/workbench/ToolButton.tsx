import type { JSX, ReactNode } from 'react';

import { Tooltip } from '../../ui/Tooltip';

interface ToolButtonProps {
	label: string;
	shortcut?: string | undefined;
	onClick: () => void;
	/** Toggle buttons stay pressed in (checkered) while on. */
	active?: boolean;
	view?: string;
	index?: number;
	badge?: number;
	children: ReactNode;
}

/** A raised 16x16 icon button of the toolbar; it presses in on click. */
export function ToolButton({
	label,
	shortcut,
	onClick,
	active,
	view,
	index,
	badge,
	children,
}: ToolButtonProps): JSX.Element {
	return (
		<Tooltip content={label} shortcut={shortcut}>
			<button
				type='button'
				aria-label={label}
				aria-pressed={active}
				data-part='activity-item'
				data-view={view}
				data-index={index}
				data-active={active ?? false}
				onClick={onClick}
				className='wb-tool'
			>
				{children}
				{badge !== undefined && badge > 0 && (
					<span data-part='activity-badge' className='wb-tool-badge num'>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</button>
		</Tooltip>
	);
}
