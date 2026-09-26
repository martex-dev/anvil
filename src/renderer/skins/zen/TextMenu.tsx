import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { getCommands } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useMenuCommand } from '../../app/hooks/use-menu-command';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { Kbd } from '../../ui/Kbd';

export interface TextMenuProps {
	label: string;
	categories: CommandCategory[];
}

/**
 * One word of the title bar's menu line ("file", "edit"...), opening a sheet of commands set
 * like a book's table of contents: title on the left, a dotted leader, the shortcut on the right.
 */
export function TextMenu({ label, categories }: TextMenuProps): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	// Commands run once the menu has closed, so focus lands where they put it.
	const { pick, onCloseAutoFocus } = useMenuCommand();
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger
				data-part='menu-trigger'
				className='no-drag px-1.5 py-1 text-12 text-fg-1 outline-none'
			>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					onCloseAutoFocus={onCloseAutoFocus}
					align='start'
					sideOffset={6}
					data-zen='menu'
					className='glass-strong animate-in z-50 max-h-[70vh] min-w-72 overflow-auto px-1 py-2'
				>
					{categories.map((cat, ci) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<div key={cat}>
								{ci > 0 && categories.length > 1 && (
									<DropdownMenu.Separator className='mx-3 my-1.5 h-px bg-glass-edge' />
								)}
								{categories.length > 1 && (
									<DropdownMenu.Label className='hud px-3 pt-1 pb-1'>
										{cat}
									</DropdownMenu.Label>
								)}
								{group.map((c) => (
									<DropdownMenu.Item
										key={c.id}
										onSelect={() => pick(c)}
										data-zen='menu-item'
										className='flex h-7 cursor-default items-baseline gap-2 px-3 pt-1 text-13 text-fg-1 outline-none data-[highlighted]:text-fg-0'
									>
										<span className='truncate'>{c.title}</span>
										<span data-zen='leader' className='min-w-4 flex-1' />
										{c.shortcut && <Kbd keys={c.shortcut} />}
									</DropdownMenu.Item>
								))}
							</div>
						);
					})}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
