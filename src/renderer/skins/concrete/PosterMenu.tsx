import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { getCommands } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useMenuCommand } from '../../app/hooks/use-menu-command';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { Kbd } from '../../ui/Kbd';

export interface PosterMenuProps {
	label: string;
	categories: CommandCategory[];
}

/**
 * One word of the title band's menu line: a bold uppercase trigger that drops a hard-shadowed
 * sheet of commands. Registers as an overlay so native web views hide behind it.
 */
export function PosterMenu({ label, categories }: PosterMenuProps): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	// Commands run once the menu has closed, so focus lands where they put it.
	const { pick, onCloseAutoFocus } = useMenuCommand();
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger data-part='menu-trigger' className='cc-menu-trigger no-drag'>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					onCloseAutoFocus={onCloseAutoFocus}
					align='start'
					sideOffset={0}
					className='glass-strong animate-in cc-sheet z-50 max-h-[70vh] min-w-64 overflow-auto p-1'
				>
					{categories.map((cat, ci) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<div key={cat}>
								{ci > 0 && categories.length > 1 && (
									<DropdownMenu.Separator className='cc-sheet-rule' />
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
											onSelect={() => pick(c)}
											className='group flex h-7 cursor-default items-center gap-2 px-2 text-12 text-fg-1 outline-none'
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
