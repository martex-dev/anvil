import type { JSX } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { pickPythonEnv, useSelectedPython } from './use-python';

/** "PY 3.12 · .venv" — click to switch interpreters. Title bar (compact) and status bar. */
export function PythonEnvChip({ compact = false }: { compact?: boolean }): JSX.Element | null {
	const { info } = useWorkspace();
	const { env, isLoading } = useSelectedPython();
	if (!info.root) return null;
	// Neutral until the query settles, so startup and folder switches don't flash an error.
	const missing = !env && !isLoading;
	const version = env?.version?.split('.').slice(0, 2).join('.') ?? null;
	return (
		<button
			type='button'
			onClick={() => void pickPythonEnv()}
			title={
				env
					? `${env.label}\n${env.path}\nClick to change`
					: isLoading
						? 'Finding the Python interpreter…'
						: 'No Python found. Click to pick an interpreter'
			}
			className={cn(
				'flex items-center gap-1.5 whitespace-nowrap outline-none transition-colors transition-fast focus-visible:shadow-glow',
				compact
					? 'no-drag h-6 rounded-md border border-glass-edge bg-bg-2/50 px-2 font-mono text-11 text-fg-1 hover:border-accent/40 hover:text-fg-0'
					: 'h-full rounded-sm px-1.5 hover:bg-bg-3/60 hover:text-fg-0',
			)}
			data-python-env={env?.path ?? ''}
			aria-busy={isLoading}
		>
			<span
				className={cn('font-mono text-[9px] font-bold', missing && 'text-down')}
				style={{ color: env ? 'var(--syn-function)' : undefined }}
			>
				PY
			</span>
			{env ? (
				<>
					<span className='num'>{version ?? '?'}</span>
					<span className='max-w-28 truncate text-fg-2'>
						{env.local ? env.label : env.kind}
					</span>
				</>
			) : isLoading ? (
				<span className='text-fg-2'>…</span>
			) : (
				<span className='text-down'>none</span>
			)}
		</button>
	);
}
