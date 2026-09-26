import type { JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { useUiStore } from '../../stores/ui-store';
import { DeskReadouts } from './DeskReadouts';

/**
 * The desk's command line, right under the title: "ANVIL ▮ _______ <GO>". It is a front for
 * Quick Open: whatever you type is handed over with its first key (so `>` means commands,
 * `@` symbols, `:` a line), a click opens it empty and <GO> opens the command palette.
 */
export function CommandLine(): JSX.Element {
	const openQuickOpen = useUiStore((s) => s.openQuickOpen);
	const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
	const quick = shortcutFor('file.quickOpen') ?? 'Ctrl+P';
	const palette = shortcutFor('view.palette') ?? 'Ctrl+Shift+P';
	return (
		<div className='ck-cmdline' role='toolbar' aria-label='Command line'>
			<label className='ck-prompt'>
				<span className='ck-prompt-ps' aria-hidden>
					ANVIL
				</span>
				<span className='ck-caret' aria-hidden />
				<input
					className='ck-prompt-input'
					aria-label={`Command line: type a file name, > for commands, @ for symbols, : for a line (${quick})`}
					placeholder='FILE · >COMMAND · @SYMBOL · :LINE'
					spellCheck={false}
					autoComplete='off'
					value=''
					onMouseDown={(e) => {
						// Clicking goes straight to Quick Open; the field itself never holds text.
						e.preventDefault();
						openQuickOpen('');
					}}
					onChange={(e) => openQuickOpen(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							openQuickOpen('');
						}
					}}
				/>
				<span className='ck-prompt-hint num' aria-hidden>
					{quick}
				</span>
			</label>
			<button
				type='button'
				className='ck-go'
				title={`Command palette (${palette})`}
				onClick={() => setPaletteOpen(true)}
			>
				&lt;GO&gt;
			</button>
			<DeskReadouts />
		</div>
	);
}
