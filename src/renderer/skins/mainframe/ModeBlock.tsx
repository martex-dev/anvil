import type { JSX } from 'react';

import { StatusSeg } from './StatusSeg';
import { useMode } from './use-mode';

const TITLES = {
	NRM: 'Normal: focus is in the chrome',
	INS: 'Insert: typing in the editor',
	VIS: 'Visual: text is selected',
	TRM: 'Terminal: keys go to the shell',
	CMD: 'Command: a prompt or menu is open',
} as const;

/** `[NRM]`: the vim mode block at the start of the status line. */
export function ModeBlock(): JSX.Element {
	const mode = useMode();
	return (
		<StatusSeg rev title={TITLES[mode]} className='mf-mode'>
			<span data-mode={mode}>{mode}</span>
		</StatusSeg>
	);
}
