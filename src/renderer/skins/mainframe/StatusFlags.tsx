import type { JSX } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { useGhostStatus } from '../../features/ai/ghost-status';
import { cn } from '../../lib/cn';
import { StatusSeg } from './StatusSeg';

/** `ai+` / `ai-` and `shld+` / `shld-`: autocomplete and the secret shield, as vim flags. */
export function StatusFlags(): JSX.Element {
	const { settings, update } = useSettings();
	const ghost = useGhostStatus();
	const aiTitle = [
		`AI autocomplete ${settings.ghostText ? 'on' : 'off'}`,
		ghost.error ? `Last error: ${ghost.error}` : null,
		'Click to toggle',
	]
		.filter(Boolean)
		.join('\n');
	return (
		<>
			<StatusSeg
				onClick={() => update({ ghostText: !settings.ghostText })}
				title={aiTitle}
				className={cn(ghost.busy && 'mf-busy')}
			>
				<span
					className={cn(
						!settings.ghostText && 'text-fg-2',
						Boolean(ghost.error) && 'text-warn',
					)}
				>
					{settings.ghostText ? 'ai+' : 'ai-'}
				</span>
			</StatusSeg>
			<StatusSeg
				onClick={() => update({ secretShield: !settings.secretShield })}
				title={`Secret shield ${settings.secretShield ? 'on' : 'off'}: blurs .env values and flags keys and seed phrases in code`}
			>
				<span className={settings.secretShield ? '' : 'text-down'}>
					{settings.secretShield ? 'shld+' : 'shld-'}
				</span>
			</StatusSeg>
		</>
	);
}
