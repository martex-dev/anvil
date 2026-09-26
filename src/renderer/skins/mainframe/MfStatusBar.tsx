import type { JSX } from 'react';

import { UpdateIndicator } from '../../app/UpdateIndicator';
import { LspStatusItem } from '../../features/lsp/LspStatusItem';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { ModeBlock } from './ModeBlock';
import { StatusClock } from './StatusClock';
import { StatusCursor } from './StatusCursor';
import { StatusFile } from './StatusFile';
import { StatusFlags } from './StatusFlags';
import { StatusGit } from './StatusGit';
import { StatusMeter } from './StatusMeter';
import { StatusProblems } from './StatusProblems';

/**
 * A vim/tmux status line: mode block, branch, file and problems on the left; flags, meter,
 * the ruler and the clock on the right, with reverse-video blocks at both ends.
 */
export function MfStatusBar(): JSX.Element {
	return (
		<footer data-part='statusbar' className='mf-statusbar'>
			<ModeBlock />
			<StatusGit />
			<StatusFile />
			<StatusProblems />
			<span className='mf-seg mf-seg-chip'>
				<PythonEnvChip />
			</span>
			<span className='mf-seg mf-seg-chip'>
				<LspStatusItem />
			</span>
			<span className='min-w-0 flex-1' />
			<StatusFlags />
			<StatusMeter />
			<UpdateIndicator />
			<StatusCursor />
			<StatusClock />
		</footer>
	);
}
