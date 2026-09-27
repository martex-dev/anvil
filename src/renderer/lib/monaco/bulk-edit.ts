import {
	Disposable,
	type IDisposable,
} from '@codingame/monaco-vscode-api/vscode/vs/base/common/lifecycle';
import type { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';
import {
	type IBulkEditOptions,
	type IBulkEditResult,
	ResourceEdit,
	ResourceTextEdit,
} from '@codingame/monaco-vscode-api/vscode/vs/editor/browser/services/bulkEditService';
import type { IBulkEditService } from '@codingame/monaco-vscode-api/vscode/vs/editor/browser/services/bulkEditService.service';
import type { WorkspaceEdit } from '@codingame/monaco-vscode-api/vscode/vs/editor/common/languages';
import type * as Monaco from 'monaco-editor';
import * as monaco from 'monaco-editor';

import { getBulkEditOpener } from './bulk-edit-opener';
import { toWorkspacePath } from './workspace-root';

/**
 * Applies workspace edits from language features (rename, quick fixes, organize imports).
 * Monaco's standalone service only edits models that are already loaded, so renaming a
 * symbol used in files that aren't open failed outright ("Rename failed to apply edits").
 * Here those files open as background tabs and take the edits there: unsaved, reviewable,
 * undoable, and saved with Save All, as in VS Code.
 */
export class AnvilBulkEditService implements IBulkEditService {
	declare readonly _serviceBrand: undefined;

	hasPreviewHandler(): boolean {
		return false;
	}

	setPreviewHandler(): IDisposable {
		return Disposable.None;
	}

	async apply(
		editsIn: ResourceEdit[] | WorkspaceEdit,
		_options?: IBulkEditOptions,
	): Promise<IBulkEditResult> {
		const edits = Array.isArray(editsIn) ? editsIn : ResourceEdit.convert(editsIn);
		const byResource = new Map<string, { uri: URI; edits: ResourceTextEdit[] }>();
		for (const edit of edits) {
			if (!(edit instanceof ResourceTextEdit))
				throw new Error(
					'Creating, renaming or deleting files from a refactoring is not supported',
				);
			const key = edit.resource.toString();
			const entry = byResource.get(key) ?? { uri: edit.resource, edits: [] };
			entry.edits.push(edit);
			byResource.set(key, entry);
		}

		// Resolve every model first, so nothing is half-applied if one file can't be opened.
		const targets: Array<{ model: Monaco.editor.ITextModel; edits: ResourceTextEdit[] }> = [];
		for (const { uri, edits: fileEdits } of byResource.values()) {
			let model = monaco.editor.getModel(uri as unknown as Monaco.Uri);
			const path = toWorkspacePath(uri);
			// A model language features loaded on their own isn't an editor buffer: route it
			// through the editor so the change shows as unsaved and can be saved.
			const opener = getBulkEditOpener();
			if (path && opener) model = (await opener(path)) ?? model;
			if (!model) throw new Error(`Can't edit ${uri.fsPath}: it's outside the open folder`);
			const stale = fileEdits.some(
				(e) => typeof e.versionId === 'number' && model.getVersionId() !== e.versionId,
			);
			if (stale && !path) throw new Error('The file changed while the edit was computed');
			targets.push({ model, edits: fileEdits });
		}

		let totalEdits = 0;
		for (const { model, edits: fileEdits } of targets) {
			model.pushStackElement();
			model.pushEditOperations(
				[],
				fileEdits.map((e) => ({
					range: e.textEdit.range,
					text: e.textEdit.text,
					forceMoveMarkers: true,
				})),
				() => null,
			);
			model.pushStackElement();
			totalEdits += fileEdits.length;
		}
		return {
			ariaSummary: `Made ${totalEdits} edits in ${targets.length} files`,
			isApplied: totalEdits > 0,
		};
	}
}
