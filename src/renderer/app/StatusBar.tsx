import { useQuery } from '@tanstack/react-query';
import {
	ArrowDownUp,
	CircleAlert,
	Cpu,
	GitBranch,
	ShieldCheck,
	ShieldOff,
	Sparkles,
	TriangleAlert,
} from 'lucide-react';
import { type JSX, type ReactNode, useEffect, useState } from 'react';

import { useGhostStatus } from '../features/ai/ghost-status';
import { useEditorStore } from '../features/editor/editor-store';
import { useGitStatus } from '../features/git/use-git';
import { LspStatusItem } from '../features/lsp/LspStatusItem';
import { useProblems } from '../features/problems/problems-store';
import { PythonEnvChip } from '../features/python/PythonEnvChip';
import { cn } from '../lib/cn';
import { everySecond } from '../lib/every-second';
import { call } from '../lib/ipc';
import { useLayoutStore } from '../stores/layout-store';
import { runCommandById } from './commands/run';
import { useSettings } from './hooks/use-settings';
import { UpdateIndicator } from './UpdateIndicator';

function Item({
	children,
	onClick,
	title,
	className,
}: {
	children: ReactNode;
	onClick?: () => void;
	title?: string;
	className?: string;
}): JSX.Element {
	const Tag = onClick ? 'button' : 'span';
	return (
		<Tag
			{...(onClick ? { type: 'button' as const, onClick } : {})}
			title={title}
			data-part='status-item'
			className={cn(
				'flex h-full items-center gap-1 px-1.5 whitespace-nowrap outline-none',
				onClick &&
					'rounded-sm transition-colors transition-fast hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow',
				className,
			)}
		>
			{children}
		</Tag>
	);
}

function Clock(): JSX.Element {
	const [now, setNow] = useState(() => new Date());
	// Aligned to the second, so it changes together with the Windows clock (candle timing).
	useEffect(() => everySecond(setNow), []);
	const utc = now.toISOString().slice(11, 16);
	return (
		<Item title={`Local ${now.toLocaleString()}\nUTC ${now.toISOString()}`}>
			<span className='num text-fg-1'>{now.toLocaleTimeString([], { hour12: false })}</span>
			<span className='num text-fg-2'>· {utc}Z</span>
		</Item>
	);
}

/** Anvil's own footprint (all its processes), polled every few seconds. */
function PerfMeter(): JSX.Element | null {
	const q = useQuery({
		queryKey: ['app', 'metrics'],
		queryFn: () => call('app:metrics'),
		refetchInterval: 4000,
	});
	// Hold the meter's width while the first sample loads, so the items beside it don't jump.
	if (q.isPending) return <span aria-hidden className='w-24 shrink-0' />;
	if (!q.data) return null;
	const { memoryMb, cpuPercent } = q.data;
	return (
		<Item
			className='min-w-24 justify-center'
			title={`Anvil: ${memoryMb} MB across ${q.data.processes} processes, ${cpuPercent}% CPU`}
		>
			<Cpu size={11} />
			<span className='num'>
				{memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(1)}G` : `${memoryMb}M`}
			</span>
			<span className={cn('num', cpuPercent > 50 ? 'text-warn' : '')}>
				{cpuPercent.toFixed(0)}%
			</span>
		</Item>
	);
}

function GitItem(): JSX.Element | null {
	const { status } = useGitStatus();
	if (!status?.isRepo) return null;
	const changes = status.staged.length + status.unstaged.length;
	return (
		<>
			<Item
				onClick={() => runCommandById('git.switchBranch')}
				title={`${status.branch ?? 'detached'}${status.tracking ? ` → ${status.tracking}` : ''}\nClick to switch branch`}
			>
				<GitBranch size={12} className='text-accent' />
				<span
					className='num max-w-48 truncate text-fg-1'
					data-git-branch={status.branch ?? ''}
				>
					{status.branch ?? '(detached)'}
				</span>
				{changes > 0 && <span className='num text-warn'>●{changes}</span>}
			</Item>
			{(status.ahead > 0 || status.behind > 0) && (
				<Item
					onClick={() => runCommandById('git.sync')}
					title={`${status.behind} behind, ${status.ahead} ahead. Click to sync`}
				>
					<ArrowDownUp size={11} />
					<span className='num'>
						{status.behind}↓ {status.ahead}↑
					</span>
				</Item>
			)}
		</>
	);
}

function ProblemsItem(): JSX.Element {
	const errors = useProblems((s) => s.errors);
	const warnings = useProblems((s) => s.warnings);
	return (
		<Item onClick={() => useLayoutStore.getState().togglePanel('problems')} title='Problems'>
			<CircleAlert size={11} className={errors ? 'text-down' : ''} />
			<span className='num'>{errors}</span>
			<TriangleAlert size={11} className={warnings ? 'text-warn' : ''} />
			<span className='num'>{warnings}</span>
		</Item>
	);
}

function CursorItems(): JSX.Element | null {
	const cursor = useEditorStore((s) => s.cursor);
	if (!cursor) return null;
	return (
		<>
			<Item onClick={() => runCommandById('go.line')} title='Go to line (Ctrl+G)'>
				<span className='num'>
					Ln {cursor.line}, Col {cursor.column}
					{cursor.selected > 0 && (
						<span className='text-accent'>
							{' '}
							({cursor.selected} sel
							{cursor.selectedLines > 1 && ` · ${cursor.selectedLines} lines`}
							{cursor.selectedWords > 0 && ` · ${cursor.selectedWords} words`})
						</span>
					)}
				</span>
			</Item>
			<Item title='Indentation'>
				{cursor.insertSpaces ? `Spaces: ${cursor.tabSize}` : `Tab: ${cursor.tabSize}`}
			</Item>
			<Item title='Encoding'>UTF-8</Item>
			<Item title='Line endings'>{cursor.eol}</Item>
			<Item title='Language' className='text-fg-1'>
				{cursor.language}
			</Item>
		</>
	);
}

function AiItem(): JSX.Element {
	const { settings, update } = useSettings();
	const ghost = useGhostStatus();
	return (
		<Item
			onClick={() => update({ ghostText: !settings.ghostText })}
			title={`AI autocomplete ${settings.ghostText ? 'on' : 'off'}${ghost.error ? `\nLast error: ${ghost.error}` : ''}\nClick to toggle`}
		>
			<Sparkles
				size={12}
				className={cn(
					settings.ghostText
						? ghost.error
							? 'text-warn'
							: 'text-accent-2'
						: 'text-fg-2',
					ghost.busy && 'pulse-dot',
				)}
			/>
			<span>{settings.ghostText ? 'AI' : 'AI off'}</span>
		</Item>
	);
}

function ShieldItem(): JSX.Element {
	const { settings, update } = useSettings();
	return (
		<Item
			onClick={() => update({ secretShield: !settings.secretShield })}
			title={`Secret shield ${settings.secretShield ? 'on' : 'off'}: blurs .env values and flags keys and seed phrases in code`}
		>
			{settings.secretShield ? (
				<ShieldCheck size={12} className='text-up' />
			) : (
				<ShieldOff size={12} className='text-down' />
			)}
		</Item>
	);
}

export function StatusBar(): JSX.Element {
	// Two groups give way on a narrow window (clipped, not wrapped); the toggles, updates and
	// clock on the right never shrink, so they stay visible and clickable.
	return (
		<footer
			data-part='statusbar'
			className='relative z-10 flex h-[26px] shrink-0 items-stretch gap-0.5 overflow-x-clip border-t border-glass-edge bg-glass-strong px-1.5 text-11 text-fg-2 glass-blur'
		>
			<div
				data-part='status-group'
				className='flex min-w-0 items-stretch gap-0.5 overflow-x-clip'
			>
				<GitItem />
				<ProblemsItem />
				<PythonEnvChip />
				<LspStatusItem />
			</div>
			<span className='flex-1' />
			<div
				data-part='status-group'
				className='flex min-w-0 items-stretch gap-0.5 overflow-x-clip'
			>
				<CursorItems />
			</div>
			<div data-part='status-group' className='flex shrink-0 items-stretch gap-0.5'>
				<AiItem />
				<ShieldItem />
				<PerfMeter />
				<UpdateIndicator />
				<Clock />
			</div>
		</footer>
	);
}
