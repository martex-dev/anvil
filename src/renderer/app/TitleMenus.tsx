import { Menubar } from 'radix-ui';
import { type JSX, useState } from 'react';

import { cn } from '../lib/cn';
import { useRegisterOverlay } from '../stores/overlay-store';
import { Kbd } from '../ui/Kbd';
import { getCommands } from './commands/run';
import type { Command as AppCommand, CommandCategory } from './commands/types';
import { useMenuCommand } from './hooks/use-menu-command';
import { TITLE_MENUS } from './TitleMenu';

interface MenuProps {
	label: string;
	categories: CommandCategory[];
	onPick: (command: AppCommand) => void;
	onCloseAutoFocus: (event: Event) => void;
}

function Menu({ label, categories, onPick, onCloseAutoFocus }: MenuProps): JSX.Element {
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<Menubar.Menu value={label}>
			<Menubar.Trigger
				data-part='menu-trigger'
				className={cn(
					'no-drag rounded-md px-2 py-1 text-12 text-fg-1 outline-none transition-colors transition-fast',
					'hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow data-[state=open]:bg-accent-faint data-[state=open]:text-fg-0',
				)}
			>
				{label}
			</Menubar.Trigger>
			<Menubar.Portal>
				<Menubar.Content
					data-part='menu'
					align='start'
					sideOffset={4}
					onCloseAutoFocus={onCloseAutoFocus}
					className='glass-strong animate-in z-50 max-h-[70vh] min-w-64 overflow-auto p-1'
				>
					{categories.map((cat, ci) => {
						const group = items.filter((c) => c.category === cat);
						if (group.length === 0) return null;
						return (
							<div key={cat}>
								{ci > 0 && categories.length > 1 && (
									<Menubar.Separator className='my-1 h-px bg-glass-edge' />
								)}
								{categories.length > 1 && (
									<Menubar.Label className='hud px-2 pt-1.5 pb-1'>
										{cat}
									</Menubar.Label>
								)}
								{group.map((c) => {
									const Icon = c.icon;
									return (
										<Menubar.Item
											key={c.id}
											onSelect={() => onPick(c)}
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
										</Menubar.Item>
									);
								})}
							</div>
						);
					})}
				</Menubar.Content>
			</Menubar.Portal>
		</Menubar.Menu>
	);
}

/**
 * The title bar's menus as one menubar: with a menu open, Left/Right and hovering another title
 * switch menus, like every Windows app.
 */
export function TitleMenus(): JSX.Element {
	const [openMenu, setOpenMenu] = useState('');
	useRegisterOverlay(openMenu !== '');
	// The chosen command runs once its menu has closed (see useMenuCommand).
	const { pick, onCloseAutoFocus } = useMenuCommand();
	return (
		<Menubar.Root
			value={openMenu}
			onValueChange={setOpenMenu}
			loop
			aria-label='Menu'
			data-part='menubar'
			className='flex items-center'
		>
			{TITLE_MENUS.map((m) => (
				<Menu key={m.label} {...m} onPick={pick} onCloseAutoFocus={onCloseAutoFocus} />
			))}
		</Menubar.Root>
	);
}
