import type { TestNode, TestResult } from '@shared/ipc/channels/tests';

import type { TestRunState } from './results';

/** What a tree row or gutter icon shows. */
export type NodeStatus = 'running' | 'queued' | 'failed' | 'passed' | 'skipped' | 'none';

/** A node that pytest runs on its own: a function without cases, or one case. */
export function isLeaf(node: TestNode): boolean {
	return node.children.length === 0 && (node.kind === 'function' || node.kind === 'case');
}

/** Ids of the runnable tests under (and including) the given nodes. */
export function leafIds(nodes: readonly TestNode[]): string[] {
	const out: string[] = [];
	const walk = (list: readonly TestNode[]): void => {
		for (const node of list) {
			if (isLeaf(node)) out.push(node.id);
			else walk(node.children);
		}
	};
	walk(nodes);
	return out;
}

/**
 * Status of a node from its tests: something running wins, then any failure, then waiting in the
 * queue, then passed (skips among passes don't matter), then all skipped.
 */
export function statusOf(
	node: TestNode,
	run: Pick<TestRunState, 'queued' | 'current' | 'results'>,
): NodeStatus {
	return statusOfIds(leafIds([node]), run);
}

export function statusOfIds(
	ids: readonly string[],
	run: Pick<TestRunState, 'queued' | 'current' | 'results'>,
): NodeStatus {
	let failed = false;
	let queued = false;
	let passed = false;
	let skipped = 0;
	for (const id of ids) {
		if (run.current === id) return 'running';
		if (run.queued[id]) queued = true;
		const outcome: TestResult['outcome'] | undefined = run.results[id]?.outcome;
		if (outcome === 'failed' || outcome === 'error') failed = true;
		else if (outcome === 'passed') passed = true;
		else if (outcome === 'skipped') skipped++;
	}
	if (failed) return 'failed';
	if (queued) return 'queued';
	if (passed) return 'passed';
	if (ids.length > 0 && skipped === ids.length) return 'skipped';
	return 'none';
}

/**
 * Keeps nodes whose label (or any ancestor's) matches the filter, case-insensitively. A matching
 * file or class keeps all its tests; a matching test keeps its ancestors.
 */
export function filterTree(nodes: readonly TestNode[], query: string): TestNode[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...nodes];
	const out: TestNode[] = [];
	for (const node of nodes) {
		if (node.label.toLowerCase().includes(q)) {
			out.push(node);
			continue;
		}
		const children = filterTree(node.children, q);
		if (children.length > 0) out.push({ ...node, children });
	}
	return out;
}

/** Normalizes a path for comparison (Windows paths are case-insensitive, slashes vary). */
export function samePath(a: string, b: string): boolean {
	const norm = (p: string): string => p.replace(/\\/g, '/').toLowerCase();
	return norm(a) === norm(b);
}

/** The file node for an absolute path, if discovery found tests in it. */
export function fileNode(tree: readonly TestNode[], path: string): TestNode | null {
	return tree.find((node) => samePath(node.file, path)) ?? null;
}

/** Classes and functions of a file that start on a line (for the gutter/code lens). */
export function lineTargets(file: TestNode): TestNode[] {
	const out: TestNode[] = [];
	const walk = (nodes: readonly TestNode[]): void => {
		for (const node of nodes) {
			if (node.kind === 'case') continue;
			if (node.line !== null) out.push(node);
			walk(node.children);
		}
	};
	walk(file.children);
	return out;
}

/**
 * The innermost test or class whose definition starts at or above the line, for Run Test at
 * Cursor. Definitions don't record where they end, so the nearest one above wins; above the first
 * definition there is nothing to run.
 */
export function nodeAtLine(file: TestNode, line: number): TestNode | null {
	let best: TestNode | null = null;
	for (const node of lineTargets(file)) {
		if (node.line === null || node.line > line) continue;
		if (!best || (best.line ?? 0) <= node.line) best = node;
	}
	return best;
}
