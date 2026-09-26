import { ListChecks, Play, RotateCcw, SquareTerminal, TextCursorInput } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { EmptyState } from '../../ui/EmptyState';
import { Kbd } from '../../ui/Kbd';
import { InterpreterSection } from './InterpreterSection';
import { PackagesSection } from './PackagesSection';
import { RunSection } from './RunSection';
import { TasksSection } from './TasksSection';

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
			<InterpreterSection />

			<RunSection title='Run'>
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
			</RunSection>

			<TasksSection />

			<PackagesSection />
		</div>
	);
}
