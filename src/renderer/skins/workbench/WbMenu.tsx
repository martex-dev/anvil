import { Menubar } from 'radix-ui';
import type { JSX } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import { Kbd } from '../../ui/Kbd';
import type { MenuDef } from './menus';

/** The label with its mnemonic letter underlined ("F̲ile", "Gi̲t"). */
function Mnemonic({ label, mnemonic }: { label: string; mnemonic: string }): JSX.Element {
	const at = label.toLowerCase().indexOf(mnemonic);
	if (at < 0) return <>{label}</>;
	return (
		<>
			{label.slice(0, at)}
			<span className='wb-mnemonic'>{label.charAt(at)}</span>
			{label.slice(at + 1)}
		</>
	);
}

/** One drop-down of the menu bar: the commands of its categories, grouped. */
export function WbMenu({ menu }: { menu: MenuDef }): JSX.Element {
	const commands = getCommands();
	const groups = menu.categories
		.map((category) => ({
			category,
			items: commands.filter((c) => c.category === category),
		}))
		.filter((g) => g.items.length > 0);
	return (
		<Menubar.Menu value={menu.label}>
			<Menubar.Trigger data-part='menu-trigger' className='wb-menu-trigger no-drag'>
				<Mnemonic label={menu.label} mnemonic={menu.key} />
			</Menubar.Trigger>
			<Menubar.Portal>
				<Menubar.Content
					align='start'
					sideOffset={1}
					className='glass-strong wb-menu z-50 max-h-[70vh] min-w-60 overflow-y-auto'
				>
					{groups.map((group, gi) => (
						<div key={group.category}>
							{gi > 0 && <Menubar.Separator className='wb-menu-separator' />}
							{groups.length > 1 && (
								<Menubar.Label className='wb-menu-label'>
									{group.category}
								</Menubar.Label>
							)}
							{group.items.map((c) => {
								const Icon = c.icon;
								return (
									<Menubar.Item
										key={c.id}
										onSelect={() => void runCommand(c)}
										className='wb-menu-item'
									>
										<span className='wb-menu-icon'>
											{Icon && <Icon size={13} />}
										</span>
										<span className='min-w-0 flex-1 truncate'>{c.title}</span>
										{c.shortcut && (
											<Kbd keys={c.shortcut} className='wb-menu-keys' />
										)}
									</Menubar.Item>
								);
							})}
						</div>
					))}
				</Menubar.Content>
			</Menubar.Portal>
		</Menubar.Menu>
	);
}
