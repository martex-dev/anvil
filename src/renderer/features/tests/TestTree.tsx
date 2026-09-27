import { type JSX, useState } from 'react';

import type { TestNode } from '@shared/ipc/channels/tests';

import { rovingKeyDown } from '../../lib/roving';
import type { TestRunState } from './results';
import { TestRow } from './TestRow';
import { openByDefault, statusOf, visibleRows } from './tree-utils';

interface TestTreeProps {
	nodes: readonly TestNode[];
	run: TestRunState;
	selected: string | null;
	/** While filtering everything is open, so matches deep in the tree are visible. */
	filtering: boolean;
	onSelect: (node: TestNode, open: boolean) => void;
	onRun: (node: TestNode) => void;
	onDebug: (node: TestNode) => void;
}

/** The discovered tests as a keyboard-navigable tree (one Tab stop, arrows move and fold). */
export function TestTree({
	nodes,
	run,
	selected,
	filtering,
	onSelect,
	onRun,
	onDebug,
}: TestTreeProps): JSX.Element {
	// Only folds the user changed are stored; everything else follows openByDefault.
	const [folds, setFolds] = useState<Readonly<Record<string, boolean>>>({});
	const [focused, setFocused] = useState<string | null>(null);
	const rows = visibleRows(nodes, (n) => filtering || (folds[n.id] ?? openByDefault(n)));
	const tabStop = rows.some((r) => r.node.id === focused)
		? focused
		: rows.some((r) => r.node.id === selected)
			? selected
			: (rows[0]?.node.id ?? null);
	const toggle = (node: TestNode, open: boolean): void =>
		setFolds((f) => ({ ...f, [node.id]: open }));
	return (
		<ul
			role='tree'
			aria-label='Tests'
			data-part='test-tree'
			className='pb-2'
			onKeyDown={rovingKeyDown}
		>
			{rows.map((row) => (
				<TestRow
					key={row.node.id}
					row={row}
					status={statusOf(row.node, run)}
					result={run.results[row.node.id]}
					selected={selected === row.node.id}
					tabStop={tabStop === row.node.id}
					onSelect={onSelect}
					onToggle={toggle}
					onRun={onRun}
					onDebug={onDebug}
					onFocusRow={setFocused}
				/>
			))}
		</ul>
	);
}
