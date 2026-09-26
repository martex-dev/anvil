import { useMutation, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { runInTerminal } from '../terminal/terminal-store';
import { RefreshButton } from './RefreshButton';
import { RunSection } from './RunSection';
import { pickPythonEnv, pythonKeys, rescanPythonEnvs, useSelectedPython } from './use-python';

/** The folder's interpreter, its dev tools, or a way to create a venv. */
export function InterpreterSection(): JSX.Element {
	const { info } = useWorkspace();
	const { env, isLoading } = useSelectedPython();
	const tools = useQuery({
		queryKey: pythonKeys.tools(info.root, env?.path ?? null),
		queryFn: () => call('python:tools'),
		enabled: Boolean(env),
		staleTime: 60_000,
	});
	const rescan = useMutation({
		mutationFn: () => rescanPythonEnvs(info.root),
		onError: (error) => toast.error('Could not rescan interpreters', error.message),
	});
	return (
		<RunSection
			title='Interpreter'
			action={
				<RefreshButton
					label='Rescan interpreters'
					busy={rescan.isPending}
					onClick={() => rescan.mutate()}
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
									tools.data?.[t] ? 'bg-up-soft text-up' : 'bg-bg-3 text-fg-2',
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
		</RunSection>
	);
}
