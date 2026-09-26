import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useRegisterOverlay } from '../../stores/overlay-store';

export interface DeskMenuSpec {
	label: string;
	categories: CommandCategory[];
}

/**
 * One title-bar menu as a desk-style pick list: numbered rows ("01 NEW FILE ... CTRL+N"),
 * so a trader's eye reads it like a function menu. Same commands as the shared menu bar.
 */
export function DeskMenu({ label, categories }: DeskMenuSpec): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	// Rows are numbered in display order: category by category, as the menu lists them.
	const items = categories.flatMap((cat) => getCommands().filter((c) => c.category === cat));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger data-part='menu-trigger' className='ck-menu-trigger no-drag'>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align='start'
					sideOffset={2}
					className='glass-strong ck-menu z-50 max-h-[70vh] min-w-72 overflow-auto'
				>
					<div className='ck-menu-head' aria-hidden>
						<span>{label}</span>
						<span>{items.length} FUNCTIONS</span>
					</div>
					{categories.map((cat) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<DropdownMenu.Group key={cat}>
								{categories.length > 1 && (
									<DropdownMenu.Label className='ck-menu-label'>
										{cat}
									</DropdownMenu.Label>
								)}
								{group.map((c) => (
									<DropdownMenu.Item
										key={c.id}
										onSelect={() => void runCommand(c)}
										className='ck-menu-item'
									>
										<span className='ck-menu-num num'>
											{String(items.indexOf(c) + 1).padStart(2, '0')}
										</span>
										<span className='flex-1 truncate'>{c.title}</span>
										{c.shortcut && (
											<span className='ck-menu-key num'>{c.shortcut}</span>
										)}
									</DropdownMenu.Item>
								))}
							</DropdownMenu.Group>
						);
					})}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
