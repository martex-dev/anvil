import { Menubar } from 'radix-ui';
import { type JSX, useRef, useState } from 'react';

import { cn } from '../lib/cn';
import { focusedEditor } from '../lib/monaco/editors';
import { useRegisterOverlay } from '../stores/overlay-store';
import { Kbd } from '../ui/Kbd';
import { getCommands, runCommand } from './commands/run';
import type { Command as AppCommand, CommandCategory } from './commands/types';

const MENUS: Array<{ label: string; categories: CommandCategory[] }> = [
	{ label: 'File', categories: ['File'] },
	{ label: 'Edit', categories: ['Edit'] },
	{ label: 'View', categories: ['View'] },
	{ label: 'Go', categories: ['Go'] },
	{ label: 'Run', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', categories: ['AI'] },
	{ label: 'Git', categories: ['Git'] },
	{ label: 'Tools', categories: ['Tools', 'Anvil'] },
];

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
				className={cn(
					'no-drag rounded-md px-2 py-1 text-12 text-fg-1 outline-none transition-colors transition-fast',
					'hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow data-[state=open]:bg-accent-faint data-[state=open]:text-fg-0',
				)}
			>
				{label}
			</Menubar.Trigger>
			<Menubar.Portal>
				<Menubar.Content
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
	// The chosen command runs once its menu has closed (see onCloseAutoFocus).
	const picked = useRef<AppCommand | null>(null);
	const onCloseAutoFocus = (e: Event): void => {
		const command = picked.current;
		if (!command) return;
		picked.current = null;
		// Radix would put focus back on the menu title, stealing it from Find, Go to Line and
		// the like. Return it to the editor instead and let the command move it if it wants.
		e.preventDefault();
		focusedEditor()?.focus();
		void runCommand(command);
	};
	return (
		<Menubar.Root
			value={openMenu}
			onValueChange={setOpenMenu}
			loop
			aria-label='Menu'
			className='flex items-center'
		>
			{MENUS.map((m) => (
				<Menu
					key={m.label}
					{...m}
					onPick={(c) => (picked.current = c)}
					onCloseAutoFocus={onCloseAutoFocus}
				/>
			))}
		</Menubar.Root>
	);
}
