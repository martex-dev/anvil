import type { JSX } from 'react';

import { UpdateIndicator } from '../../app/UpdateIndicator';
import { LspStatusItem } from '../../features/lsp/LspStatusItem';
import { TapeCursor } from './TapeCursor';
import { TapeGit } from './TapeGit';
import { TapeProblems } from './TapeProblems';
import { TapeSwitches } from './TapeSwitches';
import { TapeTicker } from './TapeTicker';

/**
 * The status bar as a desk tape: ruled cells of state on the left and right, and between them
 * a ticker of the open files quoted by their problem counts.
 */
export function DeskTape(): JSX.Element {
	return (
		<footer data-part='statusbar' className='ck-tapebar'>
			<span className='ck-tape-tag' aria-hidden>
				TAPE
			</span>
			<TapeGit />
			<TapeProblems />
			<span className='ck-cell ck-cell-lsp'>
				<LspStatusItem />
			</span>
			<TapeTicker />
			<TapeCursor />
			<TapeSwitches />
			<span className='ck-cell ck-cell-update'>
				<UpdateIndicator />
			</span>
		</footer>
	);
}
