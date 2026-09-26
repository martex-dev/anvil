import { Command } from 'cmdk';
import { CornerDownLeft } from 'lucide-react';
import type { JSX } from 'react';

import { Kbd } from '../ui/Kbd';
import { pickCommand } from './commands/run';
import type { Command as AppCommand } from './commands/types';

/**
 * One command row, shared by the palette and Quick Open's `>` mode so both look the same and
 * both feed the palette's "Recently used" list.
 */
export function CommandItem({
	command,
	value,
	onPick,
}: {
	command: AppCommand;
	/** cmdk's match text; must be unique within the list. */
	value: string;
	/** Closes the picker; the command runs after it has closed. */
	onPick: () => void;
}): JSX.Element {
	const Icon = command.icon;
	return (
		<Command.Item
			value={value}
			keywords={command.keywords ?? []}
			onSelect={() => {
				onPick();
				pickCommand(command);
			}}
			className='group flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-13 text-fg-1 data-[selected=true]:bg-accent-faint data-[selected=true]:text-fg-0'
		>
			{Icon ? (
				<Icon size={14} className='text-fg-2 group-data-[selected=true]:text-accent' />
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
}
