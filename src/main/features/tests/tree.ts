import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { TestNode } from '@shared/ipc/channels/tests';

import type { ItemRecord } from './reporter';

/**
 * Turns collected items into file → class → function → parametrized case.
 *
 * Node ids are never split on `::` blindly: parameter ids may contain it (`test_x[a::b]`). Each
 * level's id comes from the plugin (the file part, each class's own node id), and the item's name
 * is whatever follows its parent's id.
 */
export function buildTree(items: readonly ItemRecord[], root: string): TestNode[] {
	const files: TestNode[] = [];
	const byId = new Map<string, TestNode>();

	const ensure = (parent: TestNode | null, node: Omit<TestNode, 'children'>): TestNode => {
		const existing = byId.get(node.id);
		if (existing) return existing;
		const created: TestNode = { ...node, children: [] };
		byId.set(node.id, created);
		(parent ? parent.children : files).push(created);
		return created;
	};

	for (const item of items) {
		const fileId = fileIdOf(item.nodeid);
		let parent = ensure(null, {
			id: fileId,
			kind: 'file',
			label: displayPath(item.file, root) ?? fileId,
			file: item.file,
			line: null,
		});
		for (const cls of item.classes) {
			if (!cls.nodeid.startsWith(`${parent.id}::`)) continue;
			parent = ensure(parent, {
				id: cls.nodeid,
				kind: 'class',
				label: cls.nodeid.slice(parent.id.length + 2),
				file: item.file,
				line: cls.line,
			});
		}
		const name = item.nodeid.startsWith(`${parent.id}::`)
			? item.nodeid.slice(parent.id.length + 2)
			: item.nodeid;
		const bracket = name.indexOf('[');
		if (bracket > 0 && name.endsWith(']')) {
			const fn = ensure(parent, {
				id: `${parent.id}::${name.slice(0, bracket)}`,
				kind: 'function',
				label: name.slice(0, bracket),
				file: item.file,
				line: item.line,
			});
			ensure(fn, {
				id: item.nodeid,
				kind: 'case',
				label: name.slice(bracket),
				file: item.file,
				line: item.line,
			});
		} else {
			ensure(parent, {
				id: item.nodeid,
				kind: 'function',
				label: name,
				file: item.file,
				line: item.line,
			});
		}
	}
	return files;
}

/** The path part of a node id (`tests/test_a.py` of `tests/test_a.py::test_x`). */
export function fileIdOf(nodeid: string): string {
	const at = nodeid.indexOf('::');
	return at === -1 ? nodeid : nodeid.slice(0, at);
}

/** Every node by id, for validating ids the renderer sends back. */
export function indexTree(tree: readonly TestNode[]): Map<string, TestNode> {
	const index = new Map<string, TestNode>();
	const walk = (nodes: readonly TestNode[]): void => {
		for (const node of nodes) {
			index.set(node.id, node);
			walk(node.children);
		}
	};
	walk(tree);
	return index;
}

/** `tests/test_a.py` for a file inside the root; null for anything outside it. */
export function displayPath(file: string, root: string): string | null {
	const rel = relative(root, file);
	if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
	return rel.split(sep).join('/');
}

/**
 * Command-line arguments for pytest that select the given nodes and files.
 *
 * Only nodes from the last discovery are accepted, and every file must be inside the workspace,
 * so the renderer can't smuggle in options or paths. Arguments are built from the node's real file
 * (relative to the root, which is pytest's working directory) plus the part of the id after the
 * file, because pytest's node ids are relative to its rootdir, which can be a parent folder.
 */
export function runArgs(
	ids: readonly string[],
	files: readonly string[],
	index: ReadonlyMap<string, TestNode>,
	root: string,
): { args: string[]; unknown: string[] } {
	const args: string[] = [];
	const unknown: string[] = [];
	for (const id of ids) {
		const node = index.get(id);
		const rel = node ? displayPath(node.file, root) : null;
		if (!node || !rel) {
			unknown.push(id);
			continue;
		}
		args.push(safeArg(`${rel}${id.slice(fileIdOf(id).length)}`));
	}
	for (const file of files) {
		const rel = displayPath(resolve(root, file), root);
		if (!rel || !/\.py$/i.test(rel)) {
			unknown.push(file);
			continue;
		}
		args.push(safeArg(rel));
	}
	return { args: [...new Set(args)], unknown };
}

/** A file literally named `-x.py` would otherwise read as an option. */
function safeArg(arg: string): string {
	return arg.startsWith('-') ? `./${arg}` : arg;
}
