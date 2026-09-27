import { FlaskConical, TriangleAlert } from 'lucide-react';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import type { TestNode } from '@shared/ipc/channels/tests';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { useFocusOnViewRequest } from '../../stores/view-focus-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Spinner } from '../../ui/Spinner';
import { DiscoveryState } from './DiscoveryState';
import { countResults } from './results';
import { TestDetails } from './TestDetails';
import {
	debugTests,
	discoverTests,
	ensureDiscovered,
	runTests,
	useTestsStore,
} from './tests-store';
import { TestsToolbar } from './TestsToolbar';
import { TestTree } from './TestTree';
import { toWorkspaceFile } from './traceback-links';
import { filterTree, findNode, leafIds } from './tree-utils';

/** Opens a test's file at its `def` line (single click: preview tab, focus stays here). */
function reveal(node: TestNode, root: string | null): void {
	const path = toWorkspaceFile(node.file, root);
	if (path) requestOpenFile({ path, line: node.line ?? 1, preview: true });
}

/**
 * The Test Explorer: pytest's tests as a tree with live pass/fail marks, run buttons at every
 * level, a filter, and the selected test's failure with clickable tracebacks.
 */
export function TestsView(): JSX.Element {
	const { info } = useWorkspace();
	const root = useTestsStore((s) => s.root);
	const discovery = useTestsStore((s) => s.discovery);
	const discovering = useTestsStore((s) => s.discovering);
	const discoverError = useTestsStore((s) => s.discoverError);
	const run = useTestsStore((s) => s.run);
	const selectedId = useTestsStore((s) => s.selected);
	const [filter, setFilter] = useState('');
	const filterRef = useRef<HTMLInputElement>(null);

	// Discovery belongs to a folder: opening the view (or another folder) collects once.
	useEffect(() => ensureDiscovered(), [info.root]);

	const tree = useMemo(() => (discovery?.status === 'ok' ? discovery.tree : []), [discovery]);
	const shown = useMemo(() => filterTree(tree, filter), [tree, filter]);
	const ids = useMemo(() => leafIds(tree), [tree]);
	const counts = countResults(ids, run.results);
	const selected = selectedId ? findNode(tree, selectedId) : null;
	const ready = discovery?.status === 'ok' && root === info.root;
	useFocusOnViewRequest('tests', filterRef, ready);

	if (!info.root)
		return <DiscoveryState discovery={{ status: 'noFolder', python: null }} error={null} />;
	if (root !== info.root || (discovering && !discovery && !discoverError))
		return (
			<div
				role='status'
				className='flex h-32 flex-col items-center justify-center gap-2 text-12 text-fg-2'
			>
				<Spinner />
				Collecting tests…
			</div>
		);
	if (discoverError || !discovery || discovery.status !== 'ok')
		return (
			<DiscoveryState
				discovery={discovery && discovery.status !== 'ok' ? discovery : null}
				error={discoverError}
			/>
		);

	const collectErrors = [
		...discovery.errors,
		...Object.entries(run.collectErrors).map(([id, message]) => ({ id, message })),
	].filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);
	const select = (node: TestNode): void => {
		useTestsStore.setState({ selected: node.id, details: 'test' });
		reveal(node, info.root);
	};

	return (
		<div data-part='tests-view' className='flex h-full flex-col'>
			<TestsToolbar
				ref={filterRef}
				counts={counts}
				running={run.running}
				discovering={discovering}
				filter={filter}
				onFilter={setFilter}
			/>
			{run.end?.error && (
				<p
					role='alert'
					className='selectable mx-2 mb-1 rounded-md bg-down-soft px-2 py-1 text-11 text-down'
				>
					{run.end.error}
				</p>
			)}
			{collectErrors.length > 0 && (
				<ul
					aria-label='Files that failed to import'
					className='mx-2 mb-1 flex flex-col gap-0.5'
				>
					{collectErrors.map((e) => (
						<li key={e.id}>
							<button
								type='button'
								title={e.message}
								onClick={() => {
									const path = toWorkspaceFile(e.id, info.root);
									if (path) requestOpenFile({ path, preview: true });
								}}
								className='flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-11 text-warn outline-none hover:bg-bg-3/40 focus-visible:shadow-glow'
							>
								<TriangleAlert size={12} className='shrink-0' />
								<span className='truncate'>
									{e.id}: {e.message.trim().split('\n').at(-1)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			<div className='min-h-0 flex-1 overflow-auto'>
				{tree.length === 0 ? (
					<EmptyState
						icon={<FlaskConical size={20} />}
						title='No tests found'
						description='pytest looks for test_*.py and *_test.py files with test_ functions or Test classes.'
						action={
							<Button size='sm' onClick={() => void discoverTests()}>
								Refresh
							</Button>
						}
					/>
				) : shown.length === 0 ? (
					<p className='px-3 py-2 text-12 text-fg-2'>No tests match “{filter.trim()}”.</p>
				) : (
					<TestTree
						nodes={shown}
						run={run}
						selected={selectedId}
						filtering={filter.trim() !== ''}
						onSelect={select}
						onRun={(node) => void runTests({ ids: [node.id], files: [] })}
						onDebug={(node) => void debugTests([node.id])}
					/>
				)}
			</div>
			<TestDetails node={selected} root={info.root} />
		</div>
	);
}
