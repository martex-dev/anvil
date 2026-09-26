import type { JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { Kbd } from '../../ui/Kbd';

const HINTS: Array<[string, string]> = [
	['Quick Open', 'file.quickOpen'],
	['Command Palette', 'view.palette'],
	['Ask AI', 'ai.focusChat'],
	['Toggle Terminal', 'view.toggleTerminal'],
	['Run Python File', 'python.runFile'],
];

/** What an empty editor group shows: the mark and the handful of keys worth knowing. */
export function Watermark(): JSX.Element {
	return (
		<div className='flex h-full flex-col items-center justify-center gap-8 select-none'>
			<div className='relative flex items-center justify-center'>
				<span className='absolute size-28 rounded-full bg-accent-faint blur-2xl' />
				<span className='relative size-10 rotate-45 border border-accent/60 shadow-glow-soft'>
					<span className='accent-gradient absolute inset-2 opacity-80' />
				</span>
			</div>
			<dl className='grid grid-cols-[auto_auto] items-center gap-x-6 gap-y-2.5 text-12'>
				{HINTS.map(([label, id]) => {
					const keys = shortcutFor(id);
					return keys ? (
						<div key={id} className='contents'>
							<dt className='text-right text-fg-2'>{label}</dt>
							<dd>
								<Kbd keys={keys} />
							</dd>
						</div>
					) : null;
				})}
			</dl>
		</div>
	);
}
