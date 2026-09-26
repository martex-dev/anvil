import type { JSX } from 'react';

import { useWindowState } from '../../app/hooks/use-window-state';
import { ANVIL } from './art-tools';
import { PixelIcon } from './PixelIcon';
import { useWindowTitle } from './use-window-title';
import { WbMenuBar } from './WbMenuBar';
import { WbWindowControls } from './WbWindowControls';

/**
 * The program's caption (app icon, "Anvil - strategy.py", caption buttons) over the classic
 * menu bar. The caption is the drag handle; it greys out while another program has focus.
 */
export function WbTitleBar(): JSX.Element {
	const title = useWindowTitle();
	const { focused } = useWindowState();
	return (
		<header data-part='titlebar' className='wb-titlebar relative z-20 shrink-0'>
			<div className='wb-caption drag' data-active={focused}>
				<span data-part='brand' className='wb-caption-icon'>
					<PixelIcon art={ANVIL} />
				</span>
				<span className='wb-caption-text'>{title}</span>
				<WbWindowControls />
			</div>
			<WbMenuBar />
		</header>
	);
}
