import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Maximize2, Minimize2, Plus, SquareTerminal, X } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { useProblems } from '../features/problems/problems-store';
import { ProblemsView } from '../features/problems/ProblemsView';
import {
	closeTerminal,
	focusTerminal,
	newTerminal,
	useTerminalStore,
} from '../features/terminal/terminal-store';
import { PRESETS_KEY, TerminalPane } from '../features/terminal/TerminalPane';
import { cn } from '../lib/cn';
import { call } from '../lib/ipc';
import { type PanelTab, useLayoutStore } from '../stores/layout-store';
import { useRegisterOverlay } from '../stores/overlay-store';
import { EmptyState } from '../ui/EmptyState';
import { IconButton } from '../ui/IconButton';
import { shortcutFor } from './commands/run';

function PresetMenu(): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	const presets = useQuery({
		queryKey: PRESETS_KEY,
		queryFn: () => call('terminal:presets'),
		enabled: open,
	});
	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger
				aria-label='New terminal profile'
				className='flex size-6 items-center justify-center rounded-md text-fg-2 outline-none hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow'
			>
				<ChevronDown size={13} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align='end'
					sideOffset={4}
					className='glass-strong animate-in z-50 min-w-56 p-1'
				>
					<DropdownMenu.Label className='hud px-2 pt-1 pb-1'>
						New terminal
					</DropdownMenu.Label>
					{(presets.data ?? []).map((p) => (
						<DropdownMenu.Item
							key={p.id}
							disabled={!p.available}
							onSelect={() => newTerminal(p.id)}
							className='flex h-7 cursor-default items-center gap-2 rounded-md px-2 text-12 text-fg-1 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-faint data-[highlighted]:text-fg-0'
							title={p.reason ?? undefined}
						>
							<SquareTerminal size={13} className='text-fg-2' />
							<span className='flex-1'>{p.label}</span>
							{!p.available && (
								<span className='text-10 text-fg-2'>not installed</span>
							)}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

function TabButton({
	tab,
	label,
	count,
}: {
	tab: PanelTab;
	label: string;
	count?: number;
}): JSX.Element {
	const active = useLayoutStore((s) => s.panelTab === tab);
	return (
		<button
			type='button'
			role='tab'
			aria-selected={active}
			data-part='panel-tab'
			data-active={active}
			onClick={() => useLayoutStore.getState().showPanel(tab)}
			className={cn(
				'hud relative flex h-full items-center gap-1.5 px-2 outline-none transition-colors transition-fast focus-visible:text-fg-0',
				active ? 'text-fg-0' : 'hover:text-fg-1',
			)}
		>
			{label}
			{count !== undefined && count > 0 && (
				<span className='num rounded-full bg-accent-soft px-1.5 text-accent'>{count}</span>
			)}
			{active && (
				<span
					data-part='tab-marker'
					className='accent-line absolute inset-x-2 bottom-0 h-[2px] rounded-full'
				/>
			)}
		</button>
	);
}

/** Terminals and problems, under the editor. Terminals stay mounted while hidden. */
export function BottomPanel(): JSX.Element {
	const tab = useLayoutStore((s) => s.panelTab);
	const maximized = useLayoutStore((s) => s.panelMaximized);
	const terms = useTerminalStore((s) => s.tabs);
	const activeTerm = useTerminalStore((s) => s.active);
	const problems = useProblems((s) => s.errors + s.warnings);
	// Only terminals that have been shown get a session: restored tabs don't all boot at once.
	const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
	if (tab === 'terminal' && activeTerm && !seen.has(activeTerm))
		setSeen(new Set([...seen, activeTerm]));

	return (
		<section
			aria-label='Panel'
			data-part='panel'
			className='glass pane-focus flex h-full min-h-0 flex-col overflow-hidden'
		>
			<div
				data-part='pane-header'
				className='flex h-9 shrink-0 items-center gap-1 border-b border-glass-edge pr-1.5 pl-1'
			>
				<div role='tablist' className='flex h-full items-center'>
					<TabButton tab='terminal' label='Terminal' />
					<TabButton tab='problems' label='Problems' count={problems} />
				</div>
				{tab === 'terminal' && (
					<div className='ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto'>
						{terms.map((t) => (
							<div
								key={t.id}
								data-part='terminal-chip'
								data-active={t.id === activeTerm}
								className={cn(
									'group flex h-6 shrink-0 cursor-default items-center gap-1.5 rounded-md border pr-0.5 pl-2 font-mono text-11 transition-colors transition-fast',
									t.id === activeTerm
										? 'border-accent/40 bg-accent-faint text-fg-0'
										: 'border-transparent text-fg-2 hover:bg-bg-3/50 hover:text-fg-1',
								)}
								onClick={() => focusTerminal(t.id)}
								onAuxClick={(e) => e.button === 1 && closeTerminal(t.id)}
							>
								<span
									className={cn(
										'size-1.5 rounded-full',
										t.role === 'repl'
											? 'bg-accent-2'
											: t.role === 'run'
												? 'bg-up'
												: 'bg-accent',
									)}
								/>
								{t.title}
								<button
									type='button'
									aria-label={`Kill ${t.title}`}
									onClick={(e) => {
										e.stopPropagation();
										closeTerminal(t.id);
									}}
									className='rounded-sm p-0.5 opacity-0 group-hover:opacity-100 hover:bg-bg-3'
								>
									<X size={11} />
								</button>
							</div>
						))}
					</div>
				)}
				{tab !== 'terminal' && <span className='flex-1' />}
				<div className='flex shrink-0 items-center gap-0.5'>
					{tab === 'terminal' && (
						<>
							<IconButton
								size='sm'
								label='New terminal'
								shortcut={shortcutFor('terminal.new')}
								icon={<Plus size={14} />}
								onClick={() => newTerminal('powershell')}
							/>
							<PresetMenu />
						</>
					)}
					<IconButton
						size='sm'
						label={maximized ? 'Restore panel' : 'Maximize panel'}
						icon={maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
						onClick={() => useLayoutStore.getState().toggleMaximizePanel()}
					/>
					<IconButton
						size='sm'
						label='Close panel'
						shortcut={shortcutFor('view.togglePanel')}
						icon={<X size={14} />}
						onClick={() => useLayoutStore.getState().togglePanel()}
					/>
				</div>
			</div>
			<div data-part='pane-body' className='relative min-h-0 flex-1'>
				{tab === 'problems' && <ProblemsView />}
				{terms.length === 0 && tab === 'terminal' && (
					<EmptyState
						icon={<SquareTerminal size={22} />}
						title='No terminals'
						description='PowerShell, a Python REPL, Claude Code, Codex or Gemini CLI.'
						action={
							<button
								type='button'
								onClick={() => newTerminal('powershell')}
								className='rounded-md border border-border-strong px-3 py-1 text-12 text-fg-1 hover:border-accent/40 hover:text-fg-0'
							>
								New terminal
							</button>
						}
					/>
				)}
				{terms
					.filter((t) => seen.has(t.id))
					.map((t) => {
						const visible = tab === 'terminal' && t.id === activeTerm;
						return (
							<div
								key={t.id}
								className={cn('absolute inset-0', !visible && 'invisible')}
							>
								<TerminalPane tab={t} visible={visible} />
							</div>
						);
					})}
			</div>
		</section>
	);
}
