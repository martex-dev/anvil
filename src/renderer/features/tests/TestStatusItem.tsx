import { CircleCheck, CircleX, FlaskConical } from 'lucide-react';
import type { JSX } from 'react';

import { useLayoutStore } from '../../stores/layout-store';
import { useTestsStore } from './tests-store';

/**
 * Status bar summary of the last test run (hidden until something ran): progress while running,
 * then passed / failed. Counts only what the run reported, so a single-test run reads 1 / 0.
 */
export function TestStatusItem(): JSX.Element | null {
	const run = useTestsStore((s) => s.run);
	if (run.runId === null) return null;
	let passed = 0;
	let failed = 0;
	for (const id of Object.keys(run.fresh)) {
		const outcome = run.results[id]?.outcome;
		if (outcome === 'passed') passed++;
		else if (outcome === 'failed' || outcome === 'error') failed++;
	}
	const pending = Object.keys(run.queued).length;
	const title = run.running
		? `Running tests: ${passed + failed} done, ${pending} to go`
		: run.end?.error
			? `Tests: ${run.end.error}`
			: `Last test run: ${passed} passed, ${failed} failed${run.end?.cancelled ? ' (stopped)' : ''}`;
	return (
		<button
			type='button'
			title={`${title}\nClick to show the Tests view`}
			data-part='status-item'
			data-tests-status={
				run.running ? 'running' : failed > 0 || run.end?.error ? 'failed' : 'passed'
			}
			onClick={() => useLayoutStore.getState().showView('tests')}
			className='flex h-full items-center gap-1 rounded-sm px-1.5 whitespace-nowrap outline-none transition-colors transition-fast hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow'
		>
			<FlaskConical
				size={11}
				className={
					run.running ? 'pulse-dot text-accent' : run.end?.error ? 'text-down' : ''
				}
			/>
			<CircleCheck size={11} className={passed > 0 ? 'text-up' : ''} />
			<span className='num'>{passed}</span>
			<CircleX size={11} className={failed > 0 ? 'text-down' : ''} />
			<span className='num'>{failed}</span>
			{run.running && pending > 0 && <span className='num text-fg-2'>· {pending}</span>}
		</button>
	);
}
