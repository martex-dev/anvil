import { Bug, Download, Play } from 'lucide-react';
import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Kbd } from '../../ui/Kbd';
import { Spinner } from '../../ui/Spinner';
import { BreakpointsSection } from './BreakpointsSection';
import { CallStackSection } from './CallStackSection';
import { useDebugStore } from './debug-store';
import { DebugToolbar } from './DebugToolbar';
import { installDebugpy } from './install-debugpy';
import { VariablesSection } from './VariablesSection';
import { WatchSection } from './WatchSection';

const STATUS_TEXT = {
	idle: 'Not running',
	starting: 'Starting',
	running: 'Running',
	paused: 'Paused',
	stopping: 'Stopping',
} as const;

/** The session line: what runs, its state, why it stopped, and the controls. */
function SessionHeader(): JSX.Element {
	const status = useDebugStore((s) => s.status);
	const label = useDebugStore((s) => s.label);
	const reason = useDebugStore((s) => s.stopReason);
	const detail = useDebugStore((s) => s.stopDetail);
	return (
		<div data-part='debug-session' className='border-b border-glass-edge px-3 py-2'>
			<div className='flex items-center gap-2'>
				{(status === 'starting' || status === 'stopping') && (
					<Spinner size={12} label={STATUS_TEXT[status]} />
				)}
				<span className='min-w-0 flex-1 truncate text-12 text-fg-0'>{label}</span>
				<DebugToolbar />
			</div>
			<p aria-live='polite' className='text-10 text-fg-2'>
				{STATUS_TEXT[status]}
				{status === 'paused' && reason ? ` on ${reason}` : ''}
			</p>
			{status === 'paused' && detail && (
				<p
					role='alert'
					className='mt-1 rounded-md bg-down-soft px-2 py-1 font-mono text-12 text-down'
				>
					{detail}
				</p>
			)}
		</div>
	);
}

/** Before a session: how to start one, and why the last one failed. */
function Idle(): JSX.Element {
	const error = useDebugStore((s) => s.error);
	const install = useDebugStore((s) => s.install);
	const key = shortcutFor('debug.start');
	return (
		<div className='border-b border-glass-edge px-3 py-3'>
			{install ? (
				<div role='alert' className='mb-3 flex flex-col gap-2 text-12'>
					<p className='text-fg-1'>
						debugpy is not installed in <span className='font-mono'>{install.env}</span>
						. The debugger runs it from your selected Python environment.
					</p>
					<Button
						size='sm'
						variant='primary'
						icon={<Download size={13} />}
						onClick={() => installDebugpy(install)}
					>
						Install debugpy
					</Button>
				</div>
			) : (
				error && (
					<p
						role='alert'
						className='mb-3 rounded-md bg-down-soft px-2 py-1 text-12 whitespace-pre-wrap text-down'
					>
						{error}
					</p>
				)
			)}
			<button
				type='button'
				onClick={() => runCommandById('debug.start')}
				className='group flex h-8 w-full items-center gap-2 rounded-md border border-glass-edge bg-bg-2/40 px-2 text-12 text-fg-1 outline-none transition-colors transition-fast hover:border-accent/40 hover:bg-accent-faint hover:text-fg-0 focus-visible:shadow-glow'
			>
				<Play size={13} className='text-up' />
				<span className='flex-1 text-left'>Debug Python file</span>
				{key && <Kbd keys={key} />}
			</button>
			<div className='mt-1.5 grid grid-cols-2 gap-1.5'>
				<Button size='sm' variant='ghost' onClick={() => runCommandById('debug.test')}>
					Test at cursor
				</Button>
				<Button size='sm' variant='ghost' onClick={() => runCommandById('debug.module')}>
					As module
				</Button>
			</div>
		</div>
	);
}

/** The Debug side view: session controls, Variables, Watch, Call Stack and Breakpoints. */
export function DebugView(): JSX.Element {
	const { info } = useWorkspace();
	const status = useDebugStore((s) => s.status);
	if (!info.root)
		return (
			<EmptyState
				icon={<Bug size={22} />}
				title='No folder open'
				description='Open a project to debug its Python code.'
			/>
		);
	return (
		<div className='h-full overflow-auto'>
			{status === 'idle' ? <Idle /> : <SessionHeader />}
			<VariablesSection />
			<WatchSection />
			<CallStackSection />
			<BreakpointsSection />
		</div>
	);
}
