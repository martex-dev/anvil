import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import type { JSX } from 'react';

import type { Task } from '@shared/ipc/channels/tools';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { Spinner } from '../../ui/Spinner';
import { runInTerminal } from '../terminal/terminal-store';
import { RefreshButton } from './RefreshButton';
import { RunSection } from './RunSection';
import { saveDirtyFiles } from './save-before-run';
import { SectionError } from './SectionError';
import { tasksKey } from './task-files';

async function runTask(t: Task): Promise<void> {
	// Tasks (tests, builds, scripts) read files from disk: run them on the code on screen.
	if (!(await saveDirtyFiles())) return;
	await runInTerminal({
		role: `task:${t.id}`,
		preset: 'powershell',
		title: t.label,
		command: t.command,
	});
}

/** package.json / pyproject / pytest / Makefile / justfile tasks, one click to run. */
export function TasksSection(): JSX.Element {
	const { info } = useWorkspace();
	const tasks = useQuery({
		queryKey: tasksKey(info.root),
		queryFn: () => call('tasks:list'),
		enabled: Boolean(info.root),
	});
	return (
		<RunSection
			title='Tasks'
			action={
				<RefreshButton
					label='Rescan tasks'
					busy={tasks.isFetching}
					onClick={() => void tasks.refetch()}
				/>
			}
		>
			{tasks.isLoading ? (
				<Spinner />
			) : tasks.error ? (
				<SectionError
					title='Could not list tasks'
					message={tasks.error.message}
					onRetry={() => void tasks.refetch()}
				/>
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
								onClick={() => void runTask(t)}
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
		</RunSection>
	);
}
