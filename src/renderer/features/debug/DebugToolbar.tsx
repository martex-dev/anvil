import {
	ArrowDownToDot,
	ArrowRightToLine,
	ArrowUpFromDot,
	Pause,
	Play,
	RotateCcw,
	Square,
} from 'lucide-react';
import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { IconButton } from '../../ui/IconButton';
import { useDebugStore } from './debug-store';

/** Continue / pause, the three steps, restart and stop, for the session that is running. */
export function DebugToolbar(): JSX.Element {
	const status = useDebugStore((s) => s.status);
	const paused = status === 'paused';
	const live = status === 'running' || paused;
	const button = (
		id: string,
		label: string,
		icon: JSX.Element,
		enabled: boolean,
	): JSX.Element => (
		<IconButton
			size='sm'
			label={label}
			shortcut={shortcutFor(id)}
			icon={icon}
			disabled={!enabled}
			onClick={() => runCommandById(id)}
		/>
	);
	return (
		<div
			role='toolbar'
			aria-label='Debug'
			data-part='debug-toolbar'
			className='flex items-center gap-0.5'
		>
			{status === 'running'
				? button('debug.pause', 'Pause', <Pause size={13} />, true)
				: button(
						'debug.continue',
						'Continue',
						<Play size={13} className='text-up' />,
						paused,
					)}
			{button('debug.stepOver', 'Step over', <ArrowRightToLine size={13} />, paused)}
			{button('debug.stepInto', 'Step into', <ArrowDownToDot size={13} />, paused)}
			{button('debug.stepOut', 'Step out', <ArrowUpFromDot size={13} />, paused)}
			{button('debug.restart', 'Restart', <RotateCcw size={13} />, live)}
			{button(
				'debug.stop',
				'Stop',
				<Square size={12} className='text-down' />,
				status !== 'idle',
			)}
		</div>
	);
}
