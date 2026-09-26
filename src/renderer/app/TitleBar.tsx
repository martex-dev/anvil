import {
	Bot,
	PanelBottom,
	PanelLeft,
	PanelRight,
	Play,
	Search,
	Settings as SettingsIcon,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { WINDOW_CHROME } from '@shared/constants';

import { PythonEnvChip } from '../features/python/PythonEnvChip';
import { cn } from '../lib/cn';
import { useLayoutStore } from '../stores/layout-store';
import { useRegisterOverlay } from '../stores/overlay-store';
import { useUiStore } from '../stores/ui-store';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';
import { getCommands, runCommand, runCommandById, shortcutFor } from './commands/run';
import type { CommandCategory } from './commands/types';
import { useWorkspace } from './hooks/use-workspace';

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

function Menu({ label, categories }: (typeof MENUS)[number]): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	const items = getCommands().filter((c) => categories.includes(c.category));
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger
				className={cn(
					'no-drag rounded-md px-2 py-1 text-12 text-fg-1 outline-none transition-colors transition-fast',
					'hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow data-[state=open]:bg-accent-faint data-[state=open]:text-fg-0',
				)}
			>
				{label}
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align='start'
					sideOffset={4}
					className='glass-strong animate-in z-50 max-h-[70vh] min-w-64 overflow-auto p-1'
				>
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

/** Height must match titleBarOverlay.height in main (window controls are drawn natively). */
export const TITLE_BAR_HEIGHT = WINDOW_CHROME.titleBarHeight;

export function TitleBar(): JSX.Element {
	const { info } = useWorkspace();
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const layout = useLayoutStore();
	return (
		<header
			className='drag relative z-20 flex shrink-0 items-center gap-2 pr-[150px] pl-3'
			style={{ height: TITLE_BAR_HEIGHT }}
		>
			<div className='flex items-center gap-2.5 pr-2'>
				<span aria-hidden className='relative flex size-4 items-center justify-center'>
					<span className='absolute size-3 rotate-45 accent-gradient shadow-glow' />
					<span className='absolute size-1.5 rotate-45 bg-bg-0' />
				</span>
				<span className='text-gradient font-mono text-13 font-bold tracking-[0.32em]'>
					ANVIL
				</span>
			</div>
			<nav className='flex items-center' aria-label='Menu'>
				{MENUS.map((m) => (
					<Menu key={m.label} {...m} />
				))}
			</nav>

			<button
				type='button'
				onClick={() => openQuick('')}
				className={cn(
					'no-drag group absolute left-1/2 flex h-7 w-[min(520px,36vw)] -translate-x-1/2 items-center gap-2 rounded-lg border border-glass-edge bg-bg-2/50 px-3 text-12 text-fg-2 backdrop-blur-md',
					'transition-[border-color,box-shadow,color] transition-fast hover:border-accent/40 hover:text-fg-1 hover:shadow-glow-soft focus-visible:shadow-glow focus-visible:outline-none',
				)}
			>
				<Search size={13} className='group-hover:text-accent' />
				<span className='truncate'>
					<span className='text-fg-1'>{info.name ?? 'anvil'}</span>
					<span className='mx-1.5 opacity-50'>/</span>
					files, commands, symbols, AI
				</span>
				<span className='flex-1' />
				<Kbd keys={shortcutFor('file.quickOpen') ?? 'Ctrl+P'} />
			</button>

			<div className='no-drag ml-auto flex items-center gap-1'>
				<PythonEnvChip compact />
				<IconButton
					size='sm'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					icon={<Play size={13} className='fill-current text-up' />}
					onClick={() => runCommandById('python.runFile')}
				/>
				<span className='mx-1 h-4 w-px bg-glass-edge' />
				<IconButton
					size='sm'
					label='Toggle side bar'
					shortcut={shortcutFor('view.toggleSide')}
					active={layout.sideOpen}
					icon={<PanelLeft size={14} />}
					onClick={layout.toggleSide}
				/>
				<IconButton
					size='sm'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					active={layout.panelOpen}
					icon={<PanelBottom size={14} />}
					onClick={() => layout.togglePanel()}
				/>
				<IconButton
					size='sm'
					label='Toggle AI'
					shortcut={shortcutFor('view.toggleAi')}
					active={layout.aiOpen}
					icon={layout.aiOpen ? <PanelRight size={14} /> : <Bot size={14} />}
					onClick={() => layout.toggleAi()}
				/>
				<IconButton
					size='sm'
					label='Settings'
					shortcut={shortcutFor('anvil.settings')}
					icon={<SettingsIcon size={14} />}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
		</header>
	);
}
