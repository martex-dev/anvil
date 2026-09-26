import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { getCommands } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useMenuCommand } from '../../app/hooks/use-menu-command';
import { useRegisterOverlay } from '../../stores/overlay-store';

/**
 * One word of the text menu bar ("File"), opening a pull-down of the real commands in its
 * categories, drawn like a DOS/TUI menu: a boxed list with the shortcut right-aligned.
 */
export function MfMenu({
	label,
	categories,
}: {
	label: string;
	categories: readonly CommandCategory[];
}): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	// Commands run once the menu has closed, so focus lands where they put it.
	const { pick, onCloseAutoFocus } = useMenuCommand();
	const items = open ? getCommands().filter((c) => categories.includes(c.category)) : [];
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger data-part='menu-trigger' className='mf-menu-trigger no-drag'>
				<span className='mf-mnemonic'>{label.slice(0, 1)}</span>
				{label.slice(1)}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					onCloseAutoFocus={onCloseAutoFocus}
					align='start'
					sideOffset={0}
					className='glass-strong mf-pulldown z-50 max-h-[70vh] min-w-72 overflow-auto'
				>
					{categories.map((cat, ci) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<div key={cat}>
								{ci > 0 && categories.length > 1 && (
									<DropdownMenu.Separator className='mf-rule' />
								)}
								{categories.length > 1 && (
									<DropdownMenu.Label className='hud mf-pulldown-label'>
										{cat}
									</DropdownMenu.Label>
								)}
								{group.map((c) => (
									<DropdownMenu.Item
										key={c.id}
										onSelect={() => pick(c)}
										className='mf-pulldown-item'
									>
										<span className='min-w-0 flex-1 truncate'>{c.title}</span>
										{c.shortcut && (
											<span className='mf-pulldown-key'>{c.shortcut}</span>
										)}
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
