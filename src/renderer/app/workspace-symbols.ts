import { getLoadedMonaco } from '../lib/monaco/load';
import { toWorkspacePath } from '../lib/monaco/workspace-root';

export interface WorkspaceSymbol {
	name: string;
	kind: string;
	container: string;
	path: string;
	line: number;
	column: number;
}

/** The parts of VS Code's `IWorkspaceSymbol` this view reads. */
export interface RawWorkspaceSymbol {
	name: string;
	containerName?: string | undefined;
	kind: number;
	location: {
		uri: { scheme: string; fsPath: string };
		range: { startLineNumber: number; startColumn: number };
	};
}

// LSP SymbolKind, zero-based as Monaco stores it.
const KIND = [
	'file',
	'module',
	'namespace',
	'package',
	'class',
	'method',
	'property',
	'field',
	'constructor',
	'enum',
	'interface',
	'function',
	'variable',
	'constant',
	'string',
	'number',
	'boolean',
	'array',
	'object',
	'key',
	'null',
	'enum member',
	'struct',
	'event',
	'operator',
	'type parameter',
];

export function symbolKindLabel(kind: number): string {
	return KIND[kind] ?? 'symbol';
}

/** Enough to pick from; the servers' own ranking puts the best matches first. */
export const WORKSPACE_SYMBOL_LIMIT = 200;

/**
 * Keeps the symbols that live in the open folder, as openable workspace paths. Library stubs
 * (typeshed, node_modules types outside the folder) can't be opened as project tabs.
 */
export function toWorkspaceSymbols(
	items: readonly RawWorkspaceSymbol[],
	toPath: (uri: { scheme: string; fsPath: string }) => string | null = toWorkspacePath,
): WorkspaceSymbol[] {
	const out: WorkspaceSymbol[] = [];
	for (const symbol of items) {
		const path = toPath(symbol.location.uri);
		if (!path) continue;
		out.push({
			name: symbol.name,
			kind: symbolKindLabel(symbol.kind),
			container: symbol.containerName ?? '',
			path,
			line: symbol.location.range.startLineNumber,
			column: symbol.location.range.startColumn,
		});
		if (out.length >= WORKSPACE_SYMBOL_LIMIT) break;
	}
	return out;
}

/**
 * `#` in Quick Open: asks every running language server (basedpyright, typescript) for symbols
 * matching `query` across the project, through the registry VS Code's "Go to Symbol in
 * Workspace" reads. The language clients fill it, so nothing is found until Monaco has loaded
 * and a server is running; the view says so instead of erroring.
 */
export async function workspaceSymbols(query: string): Promise<WorkspaceSymbol[]> {
	if (!getLoadedMonaco()) return [];
	// Loaded on demand: it pulls in part of the VS Code workbench, which the shell doesn't need
	// until someone searches.
	const { getWorkspaceSymbols } =
		await import('@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/search/common/search');
	const items = await getWorkspaceSymbols(query);
	return toWorkspaceSymbols(items.map((item) => item.symbol));
}
