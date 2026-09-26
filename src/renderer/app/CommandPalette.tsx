import { Command } from 'cmdk';
import { CornerDownLeft } from 'lucide-react';
import type { JSX } from 'react';

import { useRegisterOverlay } from '../stores/overlay-store';
import { useUiStore } from '../stores/ui-store';
import { Kbd } from '../ui/Kbd';
import { getCommands, runCommand } from './commands/run';
import type { CommandCategory } from './commands/types';

const ORDER: CommandCategory[] = [
	'File',
	'Edit',
	'View',
	'Go',
	'Python',
	'Run',
	'AI',
	'Git',
	'Terminal',
	'Tools',
	'Anvil',
];

export function CommandPalette(): JSX.Element {
	const open = useUiStore((s) => s.paletteOpen);
	const setOpen = useUiStore((s) => s.setPaletteOpen);
	useRegisterOverlay(open);
	const commands = getCommands();
	return (
		<Command.Dialog
			open={open}
			onOpenChange={setOpen}
			label='Command palette'
			loop
			overlayClassName='fixed inset-0 z-40 bg-scrim'
			contentClassName='glass-strong animate-in fixed top-[10vh] left-1/2 z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl'
		>
			<div className='flex items-center gap-2 border-b border-glass-edge px-3'>
				<span className='font-mono text-14 text-accent'>&gt;</span>
				<Command.Input
					autoFocus
					placeholder='Type a command…'
					className='h-12 flex-1 bg-transparent text-14 text-fg-0 outline-none placeholder:text-fg-2 focus-visible:outline-none'
				/>
				<Kbd keys='Esc' />
			</div>
			<Command.List className='max-h-[min(460px,60vh)] overflow-auto p-1'>
				<Command.Empty className='px-3 py-6 text-center text-13 text-fg-2'>
					No matching commands.
				</Command.Empty>
				{ORDER.map((category) => {
					const items = commands.filter((c) => c.category === category);
					if (items.length === 0) return null;
					return (
						<Command.Group
							key={category}
							heading={category}
							className='[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-10 [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-accent [&_[cmdk-group-heading]]:uppercase'
						>
							{items.map((command) => {
								const Icon = command.icon;
								return (
									<Command.Item
										key={command.id}
										value={`${command.category} ${command.title} ${command.id}`}
										keywords={command.keywords ?? []}
										onSelect={() => {
											setOpen(false);
											// Let the palette close (and focus return) before the command runs.
											setTimeout(() => void runCommand(command), 0);
										}}
										className='group flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-13 text-fg-1 data-[selected=true]:bg-accent-faint data-[selected=true]:text-fg-0'
									>
										{Icon ? (
											<Icon
												size={14}
												className='text-fg-2 group-data-[selected=true]:text-accent'
											/>
										) : (
											<span className='w-3.5' />
										)}
										<span className='flex-1 truncate'>
											<span className='text-fg-2'>{command.category}: </span>
											{command.title}
										</span>
										{command.shortcut && <Kbd keys={command.shortcut} />}
										<CornerDownLeft
											size={12}
											className='hidden text-fg-2 group-data-[selected=true]:block'
										/>
									</Command.Item>
								);
							})}
						</Command.Group>
					);
				})}
			</Command.List>
		</Command.Dialog>
	);
}
