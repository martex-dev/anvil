import { TriangleAlert } from 'lucide-react';
import type { JSX } from 'react';

import { Badge } from '../../ui/Badge';
import { Tooltip } from '../../ui/Tooltip';

/**
 * Shown when re-reading a file failed but its last good content is still on screen (deleted,
 * locked or unreadable after a change), so the old version isn't mistaken for the current one.
 */
export function ReloadErrorBadge({ message }: { message: string }): JSX.Element {
	const note = `Could not reload, showing the last version: ${message}`;
	return (
		<Tooltip content={note}>
			{/* Focusable so keyboard and screen-reader users can reach the explanation. */}
			<span
				tabIndex={0}
				role='status'
				aria-label={note}
				className='rounded-md focus-visible:shadow-glow focus-visible:outline-none'
			>
				<Badge tone='warn'>
					<TriangleAlert size={11} />
					Not reloaded
				</Badge>
			</span>
		</Tooltip>
	);
}
