import { X } from 'lucide-react';
import { type JSX, useRef, useState } from 'react';

import {
	closeTerminal,
	focusTerminal,
	type TermTab,
	useTerminalStore,
} from '../features/terminal/terminal-store';
import { cn } from '../lib/cn';
import { handleTabKeys } from '../lib/roving';
import { AppContextMenu } from '../ui/ContextMenu';
import { Tooltip } from '../ui/Tooltip';
import { renameTerminal, restartTerminal } from './terminal-tabs';

/** Inline name editor in place of the chip's label. Enter or leaving saves; Escape cancels. */
function RenameBox({
	tab,
	onDone,
}: {
	tab: TermTab;
	/** keyboard: finished with Enter or Escape, so focus goes back to the tab. */
	onDone: (keyboard: boolean) => void;
}): JSX.Element {
	const byKey = useRef(false);
	return (
		<input
			autoFocus
			aria-label={`Rename ${tab.title}`}
			defaultValue={tab.title}
			spellCheck={false}
			onFocus={(e) => e.currentTarget.select()}
			onBlur={(e) => {
				renameTerminal(tab.id, e.currentTarget.value);
				onDone(byKey.current);
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					byKey.current = true;
					e.currentTarget.blur();
				}
				if (e.key === 'Escape') {
					byKey.current = true;
					e.preventDefault();
					// Leaving saves, so put the old name back first.
					e.currentTarget.value = tab.title;
					e.currentTarget.blur();
				}
			}}
			className='mx-1 w-28 bg-transparent font-mono text-11 text-fg-0 outline-none'
		/>
	);
}

const tabDomId = (id: string): string => `terminal-tab-${id}`;

const dotClass = (role: string | undefined): string =>
	role === 'repl' ? 'bg-accent-2' : role === 'run' ? 'bg-up' : 'bg-accent';

/**
 * The terminal tab strip: a tablist with arrow-key navigation and a kill button per tab.
 * Double-click or F2 renames; right-click offers Rename, Restart and Kill.
 */
export function TerminalTabs(): JSX.Element {
	const terms = useTerminalStore((s) => s.tabs);
	const activeTerm = useTerminalStore((s) => s.active);
	const [renaming, setRenaming] = useState<string | null>(null);
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
					<AppContextMenu
						key={t.id}
						items={[
							{ label: 'Rename', shortcut: 'F2', onSelect: () => setRenaming(t.id) },
							{ label: 'Restart', onSelect: () => restartTerminal(t.id) },
							'separator',
							{
								label: 'Kill Terminal',
								danger: true,
								onSelect: () => closeTerminal(t.id),
							},
						]}
					>
						<div
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
							{renaming === t.id ? (
								<RenameBox
									tab={t}
									onDone={(keyboard) => {
										setRenaming(null);
										// The tab button remounts after this render; focus it then.
										if (keyboard)
											requestAnimationFrame(() =>
												document.getElementById(tabDomId(t.id))?.focus(),
											);
									}}
								/>
							) : (
								<button
									type='button'
									id={tabDomId(t.id)}
									role='tab'
									aria-selected={active}
									tabIndex={active ? 0 : -1}
									onClick={() => focusTerminal(t.id)}
									onDoubleClick={() => setRenaming(t.id)}
									onKeyDown={(e) => {
										if (e.key === 'F2') {
											e.preventDefault();
											setRenaming(t.id);
											return;
										}
										handleTabKeys(e, i, terms.length, select);
									}}
									className='flex h-full min-w-0 cursor-default items-center gap-1.5 rounded-md pl-2 outline-none focus-visible:shadow-glow'
								>
									<span
										className={cn(
											'size-1.5 shrink-0 rounded-full',
											dotClass(t.role),
										)}
									/>
									<span className='max-w-40 truncate' title={t.title}>
										{t.title}
									</span>
								</button>
							)}
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
					</AppContextMenu>
				);
			})}
		</div>
	);
}
