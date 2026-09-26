// Language grammars and the default themes are VS Code extensions; importing registers them.
import { initialize } from '@codingame/monaco-vscode-api';
import getConfigurationServiceOverride, {
	updateUserConfiguration,
} from '@codingame/monaco-vscode-configuration-service-override';
import getEditorServiceOverride, {
	type OpenEditor,
} from '@codingame/monaco-vscode-editor-service-override';
import getExtensionsServiceOverride from '@codingame/monaco-vscode-extensions-service-override';
import { registerFileSystemOverlay } from '@codingame/monaco-vscode-files-service-override';
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override';
import getLogServiceOverride from '@codingame/monaco-vscode-log-service-override';
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';
import TextMateWorker from '@codingame/monaco-vscode-textmate-service-override/worker?worker';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

import { openDefinition } from './open-definition';
import { WorkspaceFileSystem } from './workspace-fs';

// Runs VS Code extensions (the LSP client uses the `vscode` API) in this renderer thread.
import 'vscode/localExtensionHost';
import '@codingame/monaco-vscode-theme-defaults-default-extension';
import '@codingame/monaco-vscode-typescript-basics-default-extension';
import '@codingame/monaco-vscode-javascript-default-extension';
import '@codingame/monaco-vscode-python-default-extension';
import '@codingame/monaco-vscode-json-default-extension';
import '@codingame/monaco-vscode-css-default-extension';
import '@codingame/monaco-vscode-html-default-extension';
import '@codingame/monaco-vscode-markdown-basics-default-extension';
import '@codingame/monaco-vscode-yaml-default-extension';
import '@codingame/monaco-vscode-powershell-default-extension';
import '@codingame/monaco-vscode-shellscript-default-extension';
import '@codingame/monaco-vscode-bat-default-extension';
import '@codingame/monaco-vscode-sql-default-extension';
import '@codingame/monaco-vscode-xml-default-extension';
import '@codingame/monaco-vscode-ini-default-extension';
import '@codingame/monaco-vscode-rust-default-extension';
import '@codingame/monaco-vscode-go-default-extension';
import '@codingame/monaco-vscode-docker-default-extension';
import '@codingame/monaco-vscode-cpp-default-extension';
import '@codingame/monaco-vscode-java-default-extension';
import '@codingame/monaco-vscode-julia-default-extension';
import '@codingame/monaco-vscode-r-default-extension';
import '@codingame/monaco-vscode-log-default-extension';

export type MonacoApi = typeof monaco;

/** Go to definition / peek into another file: open it in Anvil's editor at that position. */
const openEditor: OpenEditor = (modelRef, options) => {
	const uri = modelRef.object.textEditorModel.uri;
	const selection = (options as { selection?: { startLineNumber: number; startColumn: number } })
		?.selection;
	modelRef.dispose();
	openDefinition({ uri, selection });
	return Promise.resolve(undefined);
};

/**
 * Boots the VS Code services Monaco runs on. Must happen exactly once, before any editor is
 * created; callers go through `loadMonaco()` which caches the promise.
 */
export async function setupMonaco(userConfiguration: string): Promise<MonacoApi> {
	(globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
		getWorker: (_moduleId: string, label: string): Worker =>
			label === 'TextMateWorker' ? new TextMateWorker() : new EditorWorker(),
	};
	await initialize({
		...getConfigurationServiceOverride(),
		...getThemeServiceOverride(),
		...getTextmateServiceOverride(),
		...getLanguagesServiceOverride(),
		// Needed by the LSP client (monaco-languageclient): the `vscode` extension API runs on the
		// extension service, and it sees editor models through the model service.
		...getLogServiceOverride(),
		...getModelServiceOverride(),
		...getExtensionsServiceOverride({ enableWorkerExtensionHost: false }),
		...getEditorServiceOverride(openEditor),
	});
	registerFileSystemOverlay(1, new WorkspaceFileSystem());
	await updateUserConfiguration(userConfiguration);
	return monaco;
}

export async function applyUserConfiguration(userConfiguration: string): Promise<void> {
	await updateUserConfiguration(userConfiguration);
}
