// Kept free of Monaco imports so it can be unit-tested; setup.ts wires it into the editor service.
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { toWorkspacePath } from './workspace-root';

interface DefinitionTarget {
	uri: { scheme: string; fsPath: string };
	selection?: { startLineNumber: number; startColumn: number } | undefined;
}

/**
 * Go to definition / peek into another file: open it in Anvil's editor at that position. Files
 * outside the open folder (site-packages, typeshed) can't be opened as tabs, so say so instead
 * of silently doing nothing.
 */
export function openDefinition({ uri, selection }: DefinitionTarget): void {
	const path = toWorkspacePath(uri);
	if (!path) {
		toast.info('Definition is outside the open folder', uri.fsPath || undefined);
		return;
	}
	requestOpenFile({
		path,
		line: selection?.startLineNumber,
		column: selection?.startColumn,
		remember: false,
	});
}
