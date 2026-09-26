import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { Kbd } from '../../ui/Kbd';

export interface HoloMenuSpec {
	label: string;
	code: string;
	categories: CommandCategory[];
}

/** One title-bar menu: a small angled tab that drops a command list. */
export function HoloMenu({ label, code, categories }: HoloMenuSpec): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger data-part='menu-trigger' className='ho-menu-trigger no-drag'>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align='start'
					sideOffset={6}
					className='glass-strong animate-in z-50 max-h-[70vh] min-w-64 overflow-auto p-1'
				>
					<div className='ho-menu-head'>
						<span>{label}</span>
						<span className='ho-menu-code'>{code}</span>
					</div>
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
											className='group flex h-7 cursor-default items-center gap-2 px-2 text-12 text-fg-1 outline-none data-[highlighted]:bg-accent-faint data-[highlighted]:text-fg-0'
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
