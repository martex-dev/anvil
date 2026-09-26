import { useQuery } from '@tanstack/react-query';
import {
	Boxes,
	FlaskConical,
	ListChecks,
	Play,
	RefreshCw,
	RotateCcw,
	SquareTerminal,
	TextCursorInput,
} from 'lucide-react';
import { type JSX, type ReactNode, useMemo, useState } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Kbd } from '../../ui/Kbd';
import { Spinner } from '../../ui/Spinner';
import { runInTerminal } from '../terminal/terminal-store';
import { pickPythonEnv, pythonKeys, useSelectedPython } from './use-python';

/** Libraries worth seeing at a glance in quant / ML / crypto work. */
const STACK = [
	'numpy',
	'pandas',
	'polars',
	'pyarrow',
	'duckdb',
	'scipy',
	'scikit-learn',
	'statsmodels',
	'torch',
	'lightgbm',
	'xgboost',
	'optuna',
	'matplotlib',
	'plotly',
	'ccxt',
	'web3',
	'solana',
	'httpx',
	'fastapi',
	'ipython',
	'pytest',
	'ruff',
];

function Section({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}): JSX.Element {
	return (
		<section className='border-b border-glass-edge px-3 py-2.5'>
			<div className='mb-2 flex items-center gap-2'>
				<h3 className='hud flex-1'>{title}</h3>
				{action}
			</div>
			{children}
		</section>
	);
}

function RunButton({
	icon,
	label,
	command,
}: {
	icon: ReactNode;
	label: string;
	command: string;
}): JSX.Element {
	const keys = shortcutFor(command);
	return (
		<button
			type='button'
			onClick={() => runCommandById(command)}
			className='group flex h-8 items-center gap-2 rounded-md border border-glass-edge bg-bg-2/40 px-2 text-12 text-fg-1 outline-none transition-colors transition-fast hover:border-accent/40 hover:bg-accent-faint hover:text-fg-0 focus-visible:shadow-glow'
		>
			<span className='text-fg-2 group-hover:text-accent'>{icon}</span>
			<span className='flex-1 text-left'>{label}</span>
			{keys && <Kbd keys={keys} />}
		</button>
	);
}

export function RunView(): JSX.Element {
	const { info } = useWorkspace();
	const { env, isLoading } = useSelectedPython();
	const tools = useQuery({
		queryKey: pythonKeys.tools(info.root, env?.path ?? null),
		queryFn: () => call('python:tools'),
		enabled: Boolean(env),
		staleTime: 60_000,
	});
	const tasks = useQuery({
		queryKey: ['tasks', info.root],
		queryFn: () => call('tasks:list'),
		enabled: Boolean(info.root),
	});
	const packages = useQuery({
		queryKey: pythonKeys.packages(info.root, env?.path ?? null),
		queryFn: () => call('python:packages'),
		enabled: Boolean(env),
		staleTime: 60_000,
	});
	const [filter, setFilter] = useState('');
	const stack = useMemo(() => {
		const byName = new Map((packages.data ?? []).map((p) => [p.name.toLowerCase(), p.version]));
		return STACK.filter((n) => byName.has(n)).map((n) => ({
			name: n,
			version: byName.get(n) ?? '',
		}));
	}, [packages.data]);
	const shown = useMemo(
		() =>
			(packages.data ?? []).filter((p) =>
				p.name.toLowerCase().includes(filter.trim().toLowerCase()),
			),
		[packages.data, filter],
	);

	if (!info.root) {
		return (
			<EmptyState
				icon={<Play size={22} />}
				title='No folder open'
				description='Open a project to run its code and tasks.'
			/>
		);
	}
	return (
		<div className='h-full overflow-auto'>
			<Section
				title='Interpreter'
				action={
					<IconButton
						size='sm'
						label='Rescan interpreters'
						icon={<RefreshCw size={12} />}
						onClick={() => void pickPythonEnv()}
					/>
				}
			>
				{isLoading ? (
					<Spinner />
				) : env ? (
					<button
						type='button'
						onClick={() => void pickPythonEnv()}
						className='w-full rounded-lg border border-glass-edge bg-bg-2/40 p-2 text-left outline-none transition-colors transition-fast hover:border-accent/40 focus-visible:shadow-glow'
					>
						<div className='flex items-center gap-2'>
							<span className='text-gradient font-mono text-16 font-bold'>
								{env.version ?? '?'}
							</span>
							<span className='text-12 text-fg-0'>{env.label}</span>
							<span className='hud ml-auto'>{env.kind}</span>
						</div>
						<div className='mt-1 truncate font-mono text-10 text-fg-2' title={env.path}>
							{env.path}
						</div>
						<div className='mt-2 flex flex-wrap gap-1'>
							{(['ipython', 'ruff', 'pytest'] as const).map((t) => (
								<span
									key={t}
									className={cn(
										'rounded-sm px-1.5 py-0.5 font-mono text-10',
										tools.data?.[t]
											? 'bg-up-soft text-up'
											: 'bg-bg-3 text-fg-2',
									)}
								>
									{tools.data?.[t] ? '✓' : '·'} {t}
								</span>
							))}
						</div>
					</button>
				) : (
					<div className='flex flex-col gap-2 text-12 text-fg-2'>
						No Python interpreter found for this folder.
						<Button
							size='sm'
							onClick={() =>
								void runInTerminal({
									role: 'setup',
									preset: 'powershell',
									title: 'setup',
									command: 'uv venv',
								})
							}
						>
							Create .venv with uv
						</Button>
					</div>
				)}
			</Section>

			<Section title='Run'>
				<div className='flex flex-col gap-1.5'>
					<RunButton
						icon={<Play size={13} />}
						label='Run file'
						command='python.runFile'
					/>
					<RunButton
						icon={<ListChecks size={13} />}
						label='Run cell'
						command='python.runCell'
					/>
					<RunButton
						icon={<TextCursorInput size={13} />}
						label='Run selection / line'
						command='python.runSelection'
					/>
					<div className='grid grid-cols-2 gap-1.5'>
						<RunButton
							icon={<SquareTerminal size={13} />}
							label='REPL'
							command='python.openRepl'
						/>
						<RunButton
							icon={<RotateCcw size={13} />}
							label='Restart'
							command='python.restartRepl'
						/>
					</div>
				</div>
			</Section>

			<Section
				title='Tasks'
				action={
					<IconButton
						size='sm'
						label='Rescan tasks'
						icon={<RefreshCw size={12} />}
						onClick={() => void tasks.refetch()}
					/>
				}
			>
				{tasks.isLoading ? (
					<Spinner />
				) : (tasks.data ?? []).length === 0 ? (
					<p className='text-12 text-fg-2'>
						No tasks found (package.json scripts, pyproject scripts, pytest, Makefile,
						justfile).
					</p>
				) : (
					<ul className='flex flex-col'>
						{(tasks.data ?? []).map((t) => (
							<li key={t.id}>
								<button
									type='button'
									title={`${t.command}${t.detail ? `\n${t.detail}` : ''}`}
									onClick={() =>
										void runInTerminal({
											role: `task:${t.id}`,
											preset: 'powershell',
											title: t.label,
											command: t.command,
										})
									}
									className='group flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-12 outline-none hover:bg-accent-faint focus-visible:bg-accent-faint'
								>
									<Play
										size={11}
										className='shrink-0 text-fg-2 group-hover:text-up'
									/>
									<span className='truncate text-fg-0'>{t.label}</span>
									<span className='ml-auto shrink-0 font-mono text-10 text-fg-2'>
										{t.source}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Section>

			<Section
				title={`Packages${packages.data ? ` · ${packages.data.length}` : ''}`}
				action={
					<IconButton
						size='sm'
						label='Refresh packages'
						icon={<RefreshCw size={12} />}
						onClick={() => void packages.refetch()}
					/>
				}
			>
				{!env ? (
					<p className='text-12 text-fg-2'>Select an interpreter to list its packages.</p>
				) : packages.isLoading ? (
					<div className='shimmer h-16 rounded-md' />
				) : packages.error ? (
					<p className='text-12 text-down'>{packages.error.message}</p>
				) : (
					<>
						{stack.length > 0 && (
							<div className='mb-2 flex flex-wrap gap-1'>
								{stack.map((p) => (
									<span
										key={p.name}
										className='flex items-center gap-1 rounded-md border border-glass-edge bg-bg-2/40 px-1.5 py-0.5 text-11'
									>
										<Boxes size={10} className='text-accent' />
										{p.name}
										<span className='num text-fg-2'>{p.version}</span>
									</span>
								))}
							</div>
						)}
						<Input
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder='Filter packages'
							className='mb-1 h-6 text-12'
							leading={<FlaskConical size={11} />}
						/>
						<ul className='max-h-72 overflow-auto'>
							{shown.map((p) => (
								<li
									key={p.name}
									className='flex h-6 items-center gap-2 px-1 text-12'
								>
									<span className='truncate text-fg-1'>{p.name}</span>
									<span className='num ml-auto text-11 text-fg-2'>
										{p.version}
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</Section>
		</div>
	);
}
