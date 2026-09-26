import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { Kbd } from '../../ui/Kbd';

/** One title bar menu: a small jelly pill that drops a candy sheet of its commands. */
export function YkMenu({
	label,
	categories,
}: {
	label: string;
	categories: CommandCategory[];
}): JSX.Element {
	const [open, setOpen] = useState(false);
	// Webviews hide while any overlay is open, or they would paint over the menu.
	useRegisterOverlay(open);
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger data-part='menu-trigger' className='no-drag yk-pill-menu'>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align='start'
					sideOffset={6}
					className='glass-strong animate-in z-50 max-h-[70vh] min-w-64 overflow-auto p-1.5'
				>
					{categories.map((cat, ci) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<div key={cat}>
								{ci > 0 && categories.length > 1 && (
									<DropdownMenu.Separator className='yk-rule my-1.5' />
								)}
								{categories.length > 1 && (
									<DropdownMenu.Label className='hud px-2 pt-1.5 pb-1'>
										{cat}
									</DropdownMenu.Label>
								)}
								{group.map((c) => {
									const Icon = c.icon;
									return (
										<DropdownMenu.Item
											key={c.id}
											onSelect={() => void runCommand(c)}
											className='yk-menu-item group flex h-7 cursor-default items-center gap-2 rounded-full px-2.5 text-12 text-fg-1 outline-none'
										>
											{Icon ? (
												<Icon size={13} className='text-fg-2' />
											) : (
												<span className='w-[13px]' />
											)}
											<span className='flex-1 truncate'>{c.title}</span>
											{c.shortcut && <Kbd keys={c.shortcut} />}
										</DropdownMenu.Item>
									);
								})}
							</div>
						);
					})}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
