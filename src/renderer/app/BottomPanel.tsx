import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Maximize2, Minimize2, Plus, RotateCw, SquareTerminal, X } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type JSX, useState } from 'react';

import { useProblems } from '../features/problems/problems-store';
import { ProblemsView } from '../features/problems/ProblemsView';
import { newTerminal, useTerminalStore } from '../features/terminal/terminal-store';
import { PRESETS_KEY, TerminalPane } from '../features/terminal/TerminalPane';
import { cn } from '../lib/cn';
import { call } from '../lib/ipc';
import { handleTabKeys } from '../lib/roving';
import { type PanelTab, useLayoutStore } from '../stores/layout-store';
import { useRegisterOverlay } from '../stores/overlay-store';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';
import { Tooltip } from '../ui/Tooltip';
import { shortcutFor } from './commands/run';
import { TerminalTabs } from './TerminalTabs';

const ITEM =
	'flex h-7 cursor-default items-center gap-2 rounded-md px-2 text-12 text-fg-1 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-faint data-[highlighted]:text-fg-0';

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
			<Tooltip content='New terminal profile'>
				<DropdownMenu.Trigger
					aria-label='New terminal profile'
					className='flex size-6 items-center justify-center rounded-md text-fg-2 outline-none transition-colors transition-fast hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow'
				>
					<ChevronDown size={13} />
				</DropdownMenu.Trigger>
			</Tooltip>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align='end'
					sideOffset={4}
					className='glass-strong animate-in z-50 min-w-56 p-1'
				>
					<DropdownMenu.Label className='hud px-2 pt-1 pb-1'>
						New terminal
					</DropdownMenu.Label>
					{presets.isPending && (
						<div className='flex h-7 items-center gap-2 px-2 text-12 text-fg-2'>
							<Spinner size={12} label='Loading profiles' />
							Loading profiles…
						</div>
					)}
					{presets.isError && (
						<>
							<p role='alert' className='max-w-64 px-2 py-1 text-12 text-down'>
								Could not list terminal profiles: {presets.error.message}
							</p>
							<DropdownMenu.Item
								onSelect={(e) => {
									// Keep the menu open so the reloaded list shows in place.
									e.preventDefault();
									void presets.refetch();
								}}
								className={ITEM}
							>
								<RotateCw size={13} className='text-fg-2' />
								Retry
							</DropdownMenu.Item>
						</>
					)}
					{presets.isSuccess && presets.data.length === 0 && (
						<p className='px-2 py-1 text-12 text-fg-2'>No terminal profiles found.</p>
					)}
					{(presets.data ?? []).map((p) => (
						<DropdownMenu.Item
							key={p.id}
							disabled={!p.available}
							onSelect={() => newTerminal(p.id)}
							className={ITEM}
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

const PANEL_TABS: readonly PanelTab[] = ['terminal', 'problems'];
const PANEL_CONTENT_ID = 'bottom-panel-content';
const tabId = (tab: PanelTab): string => `bottom-panel-tab-${tab}`;
const selectPanelTab = (index: number): void => {
	const tab = PANEL_TABS[index];
	if (tab) useLayoutStore.getState().showPanel(tab);
};

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
	const index = PANEL_TABS.indexOf(tab);
	return (
		<button
			type='button'
			role='tab'
			id={tabId(tab)}
			aria-selected={active}
			aria-controls={PANEL_CONTENT_ID}
			tabIndex={active ? 0 : -1}
			onClick={() => selectPanelTab(index)}
			onKeyDown={(e) => handleTabKeys(e, index, PANEL_TABS.length, selectPanelTab)}
			className={cn(
				'hud relative flex h-full items-center gap-1.5 rounded-md px-2 outline-none transition-colors transition-fast focus-visible:text-fg-0 focus-visible:shadow-glow',
				active ? 'text-fg-0' : 'hover:text-fg-1',
			)}
		>
			{label}
			{count !== undefined && count > 0 && (
				<span className='num rounded-full bg-accent-soft px-1.5 text-accent'>{count}</span>
			)}
			{active && (
				<span className='accent-line absolute inset-x-2 bottom-0 h-[2px] rounded-full' />
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
			className='glass pane-focus animate-fade flex h-full min-h-0 flex-col overflow-hidden'
		>
			<div className='flex h-9 shrink-0 items-center gap-1 border-b border-glass-edge pr-1.5 pl-1'>
				<div role='tablist' aria-label='Panel' className='flex h-full items-center'>
					<TabButton tab='terminal' label='Terminal' />
					<TabButton tab='problems' label='Problems' count={problems} />
				</div>
				{tab === 'terminal' && <TerminalTabs />}
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
			<div
				id={PANEL_CONTENT_ID}
				role='tabpanel'
				aria-labelledby={tabId(tab)}
				className='relative min-h-0 flex-1'
			>
				{tab === 'problems' && <ProblemsView />}
				{terms.length === 0 && tab === 'terminal' && (
					<EmptyState
						icon={<SquareTerminal size={22} />}
						title='No terminals'
						description='PowerShell, a Python REPL, Claude Code, Codex or Gemini CLI.'
						action={
							<Button size='sm' onClick={() => newTerminal('powershell')}>
								New terminal
							</Button>
						}
					/>
				)}
				{terms
					.filter((t) => seen.has(t.id))
					.map((t) => {
						const visible = tab === 'terminal' && t.id === activeTerm;
						// A plate like the editor's: xterm repaints constantly and must not draw
						// straight onto the pane's live backdrop blur.
						return (
							<div
								key={t.id}
								className={cn('absolute inset-0', !visible && 'invisible')}
								style={{ background: 'var(--editor-bg)' }}
							>
								<TerminalPane tab={t} visible={visible} />
							</div>
						);
					})}
			</div>
		</section>
	);
}
