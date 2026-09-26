import type { JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { useUiStore } from '../../stores/ui-store';
import { Kbd } from '../../ui/Kbd';
import { MAGNIFIER } from './art-views';
import { PixelIcon } from './PixelIcon';

/** The toolbar's address box: a sunken combo that opens Quick Open. */
export function QuickOpenField(): JSX.Element {
	const { info } = useWorkspace();
	const openQuick = useUiStore((s) => s.openQuickOpen);
	return (
		<button
			type='button'
			data-part='command-center'
			aria-label='Go to file, command or symbol'
			onClick={() => openQuick('')}
			className='wb-combo'
		>
			<span className='wb-combo-field'>
				<PixelIcon art={MAGNIFIER} />
				<span className='min-w-0 flex-1 truncate text-left'>
					<span className='text-fg-0'>{info.name ?? 'anvil'}</span>
					<span className='text-fg-2'> - Go to file, command, symbol...</span>
				</span>
				<Kbd keys={shortcutFor('file.quickOpen') ?? 'Ctrl+P'} />
			</span>
			<span className='wb-combo-arrow' aria-hidden />
		</button>
	);
}
