import { FlaskConical } from 'lucide-react';
import type { JSX } from 'react';

import type { TestDiscovery } from '@shared/ipc/channels/tests';

import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { pickPythonEnv, useSelectedPython } from '../python/use-python';
import { runInTerminal } from '../terminal/terminal-store';
import { discoverTests } from './tests-store';

/** Installs pytest into the selected interpreter, in a terminal so the user sees what happens. */
function installPytest(uv: boolean): void {
	void runInTerminal({
		role: 'setup',
		// The python preset has the selected env activated, so `python` / `uv pip` target it.
		preset: 'python',
		title: 'setup',
		command: uv ? 'uv pip install pytest' : 'python -m pip install pytest',
	});
}

const refresh = (): void => void discoverTests();

/**
 * Everything the Tests view shows instead of a tree: why there are no tests (no Python, no
 * pytest, pytest failed) and the way out of it. Per ADR-004 pytest comes from the user's own
 * interpreter, so a missing pytest is installed there, never bundled.
 */
export function DiscoveryState({
	discovery,
	error,
}: {
	discovery: Exclude<TestDiscovery, { status: 'ok' }> | null;
	error: string | null;
}): JSX.Element {
	const { env } = useSelectedPython();
	if (error)
		return <ErrorState title='Could not collect tests' message={error} onRetry={refresh} />;
	switch (discovery?.status) {
		case 'noFolder':
		case undefined:
			return (
				<EmptyState
					icon={<FlaskConical size={20} />}
					title='No folder open'
					description='Open a Python project to find its pytest tests.'
				/>
			);
		case 'noPython':
			return (
				<EmptyState
					icon={<FlaskConical size={20} />}
					title='No Python interpreter'
					description='Tests run with the interpreter selected for this folder. Anvil ships no Python.'
					action={
						<Button size='sm' onClick={() => void pickPythonEnv()}>
							Select interpreter
						</Button>
					}
				/>
			);
		case 'noPytest':
			return (
				<EmptyState
					icon={<FlaskConical size={20} />}
					title='pytest is not installed'
					description={
						<>
							The selected interpreter has no pytest:
							<span
								className='mt-1 block truncate font-mono text-10'
								title={discovery.python ?? ''}
							>
								{discovery.python}
							</span>
						</>
					}
					action={
						<div className='flex flex-wrap items-center justify-center gap-2'>
							<Button
								size='sm'
								variant='primary'
								onClick={() => installPytest(env?.kind === 'uv')}
							>
								Install pytest
							</Button>
							<Button size='sm' onClick={() => void pickPythonEnv()}>
								Select interpreter
							</Button>
							<Button size='sm' variant='ghost' onClick={refresh}>
								Refresh
							</Button>
						</div>
					}
				/>
			);
		case 'failed':
			return (
				<div className='flex h-full flex-col'>
					<ErrorState
						title='pytest could not collect tests'
						message={discovery.message}
						onRetry={refresh}
						className='min-h-0 flex-none'
					/>
					{discovery.output && (
						<pre className='selectable mx-3 mb-3 min-h-0 flex-1 overflow-auto rounded-md bg-bg-2/60 p-2 font-mono text-10 whitespace-pre-wrap text-fg-1'>
							{discovery.output}
						</pre>
					)}
				</div>
			);
	}
}
