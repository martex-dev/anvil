import type { JSX } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { UpdateIndicator } from '../../app/UpdateIndicator';
import { useGhostStatus } from '../../features/ai/ghost-status';
import { LspStatusItem } from '../../features/lsp/LspStatusItem';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { ColophonItem } from './ColophonItem';

/** The machinery, set small at the right margin: interpreter, language servers, AI, shield. */
export function ServicePhrases(): JSX.Element {
	const { settings, update } = useSettings();
	const ghost = useGhostStatus();
	return (
		<>
			<PythonEnvChip />
			<LspStatusItem />
			<ColophonItem
				onClick={() => update({ ghostText: !settings.ghostText })}
				title={`AI autocomplete ${settings.ghostText ? 'on' : 'off'}${ghost.error ? `\nLast error: ${ghost.error}` : ''}`}
				className={ghost.busy ? 'zn-busy' : ghost.error ? 'zn-errors' : ''}
			>
				{settings.ghostText ? 'ai' : 'ai off'}
			</ColophonItem>
			<ColophonItem
				onClick={() => update({ secretShield: !settings.secretShield })}
				title={`Secret shield ${settings.secretShield ? 'on' : 'off'}: blurs .env values and flags keys in code`}
				className={settings.secretShield ? '' : 'zn-errors'}
			>
				{settings.secretShield ? 'shielded' : 'unshielded'}
			</ColophonItem>
			<UpdateIndicator />
		</>
	);
}
