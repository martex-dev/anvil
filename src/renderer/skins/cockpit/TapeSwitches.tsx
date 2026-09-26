import type { JSX } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { useGhostStatus } from '../../features/ai/ghost-status';
import { TapeCell } from './TapeCell';

/** AI autocomplete and the secret shield as two lit/unlit switches: "AI ON  SHLD ON". */
export function TapeSwitches(): JSX.Element {
	const { settings, update } = useSettings();
	const ghost = useGhostStatus();
	const aiTone = !settings.ghostText
		? 'ck-field-dim'
		: ghost.error
			? 'ck-field-warn'
			: 'ck-field-up';
	return (
		<>
			<TapeCell
				onClick={() => update({ ghostText: !settings.ghostText })}
				title={`AI autocomplete ${settings.ghostText ? 'on' : 'off'}${ghost.error ? `\nLast error: ${ghost.error}` : ''}\nClick to toggle`}
			>
				<span className='ck-field-label'>AI</span>
				<span className={aiTone} data-busy={ghost.busy || undefined}>
					{settings.ghostText ? 'ON' : 'OFF'}
				</span>
			</TapeCell>
			<TapeCell
				onClick={() => update({ secretShield: !settings.secretShield })}
				title={`Secret shield ${settings.secretShield ? 'on' : 'off'}: blurs .env values and flags keys and seed phrases in code`}
			>
				<span className='ck-field-label'>SHLD</span>
				<span className={settings.secretShield ? 'ck-field-up' : 'ck-field-down'}>
					{settings.secretShield ? 'ON' : 'OFF'}
				</span>
			</TapeCell>
		</>
	);
}
