import { Sparkles } from 'lucide-react';
import type { JSX } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { useGhostStatus } from '../../features/ai/ghost-status';
import { cn } from '../../lib/cn';
import { StatusCell } from './StatusCell';

/** AI autocomplete as a subsystem that is online, faulted or offline. */
export function AiToggle(): JSX.Element {
	const { settings, update } = useSettings();
	const ghost = useGhostStatus();
	const on = settings.ghostText;
	return (
		<StatusCell
			onClick={() => update({ ghostText: !on })}
			title={`AI autocomplete ${on ? 'on' : 'off'}${ghost.error ? `\nLast error: ${ghost.error}` : ''}\nClick to toggle`}
		>
			<Sparkles
				size={12}
				className={cn(
					on ? (ghost.error ? 'text-warn' : 'text-accent') : 'text-fg-2',
					ghost.busy && 'pulse-dot',
				)}
			/>
			<span className={cn('ho-cell-tag', on && !ghost.error && 'text-accent')}>
				{on ? (ghost.error ? 'AI FAULT' : 'AI ONLINE') : 'AI OFFLINE'}
			</span>
		</StatusCell>
	);
}
