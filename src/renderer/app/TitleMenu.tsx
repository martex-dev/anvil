import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { cn } from '../lib/cn';
import { useRegisterOverlay } from '../stores/overlay-store';
import { Kbd } from '../ui/Kbd';
import { getCommands, runCommand } from './commands/run';
import type { CommandCategory } from './commands/types';

/** The menu bar: each menu lists the commands of its categories. */
export const TITLE_MENUS: Array<{ label: string; categories: CommandCategory[] }> = [
	{ label: 'File', categories: ['File'] },
	{ label: 'Edit', categories: ['Edit'] },
	{ label: 'View', categories: ['View'] },
	{ label: 'Go', categories: ['Go'] },
	{ label: 'Run', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', categories: ['AI'] },
	{ label: 'Git', categories: ['Git'] },
	{ label: 'Tools', categories: ['Tools', 'Anvil'] },
];

/**
 * One menu of the menu bar. Shared so replacement title bars can reuse it: restyle it through
 * `[data-part='menu-trigger']` / `[data-part='menu']`, or pass a className for the trigger.
 */
export function TitleMenu({
	label,
	categories,
	className,
}: (typeof TITLE_MENUS)[number] & { className?: string }): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger
				data-part='menu-trigger'
				className={cn(
					'no-drag rounded-md px-2 py-1 text-12 text-fg-1 outline-none transition-colors transition-fast',
					'hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow data-[state=open]:bg-accent-faint data-[state=open]:text-fg-0',
					className,
				)}
			>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					data-part='menu'
					align='start'
					sideOffset={4}
					className='glass-strong animate-in z-50 max-h-[70vh] min-w-64 overflow-auto p-1'
				>
					{categories.map((cat, ci) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<div key={cat}>
								{ci > 0 && categories.length > 1 && (
									<DropdownMenu.Separator className='my-1 h-px bg-glass-edge' />
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
											className='group flex h-7 cursor-default items-center gap-2 rounded-md px-2 text-12 text-fg-1 outline-none data-[highlighted]:bg-accent-faint data-[highlighted]:text-fg-0'
										>
											{Icon ? (
												<Icon
													size={13}
													className='text-fg-2 group-data-[highlighted]:text-accent'
												/>
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
