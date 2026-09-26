import { X } from 'lucide-react';
import type { JSX } from 'react';

import {
	closeTerminal,
	focusTerminal,
	useTerminalStore,
} from '../features/terminal/terminal-store';
import { cn } from '../lib/cn';
import { handleTabKeys } from '../lib/roving';
import { Tooltip } from '../ui/Tooltip';

/** The terminal tab strip: a tablist with arrow-key navigation and a kill button per tab. */
export function TerminalTabs(): JSX.Element {
	const terms = useTerminalStore((s) => s.tabs);
	const activeTerm = useTerminalStore((s) => s.active);
	// Arrow keys move between tabs (focus stays on the strip); a click moves into the terminal.
	const select = (index: number): void => {
		const target = terms[index];
		if (target) useTerminalStore.getState().setActive(target.id);
	};
	return (
		<div
			role='tablist'
			aria-label='Terminals'
			className='ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto'
		>
			{terms.map((t, i) => {
				const active = t.id === activeTerm;
				return (
					<div
						key={t.id}
						data-part='terminal-chip'
						data-active={active}
						className={cn(
							'group flex h-6 shrink-0 items-center gap-0.5 rounded-md border pr-0.5 font-mono text-11 transition-colors transition-fast',
							active
								? 'border-accent/40 bg-accent-faint text-fg-0'
								: 'border-transparent text-fg-2 hover:bg-bg-3/50 hover:text-fg-1',
						)}
						onAuxClick={(e) => e.button === 1 && closeTerminal(t.id)}
					>
						<button
							type='button'
							role='tab'
							aria-selected={active}
							tabIndex={active ? 0 : -1}
							onClick={() => focusTerminal(t.id)}
							onKeyDown={(e) => handleTabKeys(e, i, terms.length, select)}
							className='flex h-full min-w-0 cursor-default items-center gap-1.5 rounded-md pl-2 outline-none focus-visible:shadow-glow'
						>
							<span
								className={cn(
									'size-1.5 shrink-0 rounded-full',
									t.role === 'repl'
										? 'bg-accent-2'
										: t.role === 'run'
											? 'bg-up'
											: 'bg-accent',
								)}
							/>
							<span className='max-w-40 truncate' title={t.title}>
								{t.title}
							</span>
						</button>
						<Tooltip content='Kill terminal'>
							<button
								type='button'
								aria-label={`Kill ${t.title}`}
								onClick={() => closeTerminal(t.id)}
								className='rounded-sm p-0.5 opacity-0 outline-none group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-bg-3 focus-visible:opacity-100 focus-visible:shadow-glow'
							>
								<X size={11} />
							</button>
						</Tooltip>
					</div>
				);
			})}
		</div>
	);
}
