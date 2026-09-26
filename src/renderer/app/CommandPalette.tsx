import { Command } from 'cmdk';
import { type JSX, useState } from 'react';

import { useRegisterOverlay } from '../stores/overlay-store';
import { useUiStore } from '../stores/ui-store';
import { Kbd } from '../ui/Kbd';
import { CommandItem } from './CommandItem';
import { readRecentCommands } from './commands/recent';
import { getCommands } from './commands/run';
import type { Command as AppCommand, CommandCategory } from './commands/types';

const ORDER: CommandCategory[] = [
	'File',
	'Edit',
	'View',
	'Go',
	'Python',
	'Data',
	'Run',
	'AI',
	'Git',
	'Terminal',
	'Tools',
	'Anvil',
];

const GROUP_CLASS =
	'[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-10 [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-accent [&_[cmdk-group-heading]]:uppercase';

export function CommandPalette(): JSX.Element {
	const open = useUiStore((s) => s.paletteOpen);
	const setOpen = useUiStore((s) => s.setPaletteOpen);
	const [search, setSearch] = useState('');
	useRegisterOverlay(open);
	const commands = getCommands();
	// Read on every open so the list reflects what you just ran.
	const recent = open
		? readRecentCommands()
				.map((id) => commands.find((c) => c.id === id))
				.filter((c): c is AppCommand => c !== undefined)
		: [];

	const item = (command: AppCommand, prefix: string): JSX.Element => (
		<CommandItem
			key={`${prefix}${command.id}`}
			command={command}
			value={`${prefix}${command.category} ${command.title} ${command.id}`}
			onPick={() => {
				setOpen(false);
				setSearch('');
			}}
		/>
	);

	return (
		<Command.Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setSearch('');
			}}
			label='Command palette'
			loop
			overlayClassName='fixed inset-0 z-40 bg-scrim'
			contentClassName='glass-strong animate-in fixed top-[10vh] left-1/2 z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl'
		>
			<div className='flex items-center gap-2 border-b border-glass-edge px-3'>
				<span className='font-mono text-14 text-accent'>&gt;</span>
				<Command.Input
					autoFocus
					value={search}
					onValueChange={setSearch}
					placeholder='Type a command…'
					className='h-12 flex-1 bg-transparent text-14 text-fg-0 outline-none placeholder:text-fg-2 focus-visible:outline-none'
				/>
				<Kbd keys='Esc' />
			</div>
			<Command.List className='max-h-[min(460px,60vh)] overflow-auto p-1'>
				<Command.Empty className='px-3 py-6 text-center text-13 text-fg-2'>
					No matching commands.
				</Command.Empty>
				{/* Recents only while browsing: once you type, each command appears once. */}
				{search === '' && recent.length > 0 && (
					<Command.Group heading='Recently used' className={GROUP_CLASS}>
						{recent.map((c) => item(c, 'recent '))}
					</Command.Group>
				)}
				{ORDER.map((category) => {
					const items = commands.filter((c) => c.category === category);
					if (items.length === 0) return null;
					return (
						<Command.Group key={category} heading={category} className={GROUP_CLASS}>
							{items.map((c) => item(c, ''))}
						</Command.Group>
					);
				})}
			</Command.List>
		</Command.Dialog>
	);
}
