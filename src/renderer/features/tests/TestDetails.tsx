import { type JSX, useMemo } from 'react';

import type { TestNode, TestResult } from '@shared/ipc/channels/tests';

import { cn } from '../../lib/cn';
import { handleTabKeys } from '../../lib/roving';
import { requestOpenFile } from '../../stores/workbench-store';
import { countResults, formatDuration } from './results';
import { useTestsStore } from './tests-store';
import { TestStatusIcon } from './TestStatusIcon';
import { linkify, toWorkspaceFile } from './traceback-links';
import { leafIds, statusOfIds } from './tree-utils';

const TABS = [
	{ id: 'test', label: 'Result' },
	{ id: 'output', label: 'Output' },
] as const;

function open(path: string, line: number, root: string | null): void {
	const file = toWorkspaceFile(path, root);
	if (file) requestOpenFile({ path: file, line, preview: true });
}

/** Traceback or console text with `path:line` references that open the file. */
function LinkedText({ text, root }: { text: string; root: string | null }): JSX.Element {
	const segments = useMemo(() => linkify(text), [text]);
	return (
		<pre className='selectable font-mono text-11 leading-relaxed whitespace-pre-wrap text-fg-1'>
			{segments.map((segment, i) =>
				'path' in segment && toWorkspaceFile(segment.path, root) ? (
					<button
						// Segments never reorder; the index is a stable key.
						key={i}
						type='button'
						onClick={() => open(segment.path, segment.line, root)}
						className='rounded-sm text-accent underline decoration-dotted underline-offset-2 outline-none hover:text-fg-0 focus-visible:shadow-glow'
					>
						{segment.text}
					</button>
				) : (
					<span key={i}>{segment.text}</span>
				),
			)}
		</pre>
	);
}

function ResultDetails({
	node,
	result,
	root,
}: {
	node: TestNode;
	result: TestResult;
	root: string | null;
}): JSX.Element {
	return (
		<div className='flex flex-col gap-2'>
			<div className='flex items-center gap-1.5 text-12'>
				<TestStatusIcon status={result.outcome === 'error' ? 'failed' : result.outcome} />
				<span className='truncate font-medium text-fg-0'>{node.label}</span>
				<span className='hud shrink-0'>{result.outcome}</span>
				<span className='num ml-auto shrink-0 text-10 text-fg-2'>
					{formatDuration(result.duration)}
				</span>
			</div>
			{result.message && (
				<p
					className={cn(
						'selectable font-mono text-11 whitespace-pre-wrap',
						result.outcome === 'skipped' ? 'text-warn' : 'text-down',
					)}
				>
					{result.message}
				</p>
			)}
			{result.crash && toWorkspaceFile(result.crash.path, root) && (
				<button
					type='button'
					onClick={() => result.crash && open(result.crash.path, result.crash.line, root)}
					className='self-start rounded-sm text-11 text-accent outline-none hover:text-fg-0 focus-visible:shadow-glow'
				>
					Go to failure · {toWorkspaceFile(result.crash.path, root)}:{result.crash.line}
				</button>
			)}
			{result.traceback && <LinkedText text={result.traceback} root={root} />}
		</div>
	);
}

/** The details area under the tree: the selected test's result, or the run's console output. */
export function TestDetails({
	node,
	root,
}: {
	node: TestNode | null;
	root: string | null;
}): JSX.Element {
	const tab = useTestsStore((s) => s.details);
	const run = useTestsStore((s) => s.run);
	const result = node ? run.results[node.id] : undefined;
	const index = TABS.findIndex((t) => t.id === tab);
	const select = (i: number): void => {
		const next = TABS[i];
		if (next) useTestsStore.setState({ details: next.id });
	};
	let body: JSX.Element;
	if (tab === 'output') {
		body = run.output ? (
			<LinkedText text={run.output} root={root} />
		) : (
			<p className='text-12 text-fg-2'>
				{run.running ? 'Waiting for output…' : 'Run tests to see pytest’s output here.'}
			</p>
		);
	} else if (!node) {
		body = <p className='text-12 text-fg-2'>Select a test to see its result.</p>;
	} else if (result) {
		body = <ResultDetails node={node} result={result} root={root} />;
	} else if (node.children.length > 0) {
		const ids = leafIds([node]);
		const c = countResults(ids, run.results);
		body = (
			<div className='flex items-center gap-1.5 text-12 text-fg-1'>
				<TestStatusIcon status={statusOfIds(ids, run)} />
				<span className='truncate font-medium text-fg-0'>{node.label}</span>
				<span className='num ml-auto shrink-0 text-11 text-fg-2'>
					{c.passed} passed · {c.failed} failed · {c.skipped} skipped · {c.notRun} not run
				</span>
			</div>
		);
	} else {
		body = <p className='text-12 text-fg-2'>{node.label} hasn’t run yet.</p>;
	}
	return (
		<section
			aria-label='Test details'
			data-part='test-details'
			className='flex max-h-[45%] min-h-24 shrink-0 flex-col border-t border-glass-edge'
		>
			<div
				role='tablist'
				aria-label='Details'
				className='flex h-7 shrink-0 items-center gap-1 px-2'
			>
				{TABS.map((t, i) => (
					<button
						key={t.id}
						type='button'
						role='tab'
						aria-selected={tab === t.id}
						tabIndex={tab === t.id ? 0 : -1}
						onClick={() => select(i)}
						onKeyDown={(e) => handleTabKeys(e, index, TABS.length, select)}
						className={cn(
							'hud rounded-sm px-1.5 py-0.5 outline-none focus-visible:shadow-glow',
							tab === t.id
								? 'bg-accent-faint text-accent'
								: 'text-fg-2 hover:text-fg-1',
						)}
					>
						{t.label}
					</button>
				))}
			</div>
			<div role='tabpanel' className='min-h-0 flex-1 overflow-auto px-3 pb-3'>
				{body}
			</div>
		</section>
	);
}
