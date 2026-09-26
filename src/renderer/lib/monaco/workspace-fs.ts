import { Emitter } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
import {
	Disposable,
	type IDisposable,
} from '@codingame/monaco-vscode-api/vscode/vs/base/common/lifecycle';
import type { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';
import {
	FileSystemProviderCapabilities,
	FileSystemProviderError,
	FileSystemProviderErrorCode,
	FileType,
	type IFileSystemProviderWithFileReadWriteCapability,
	type IStat,
} from '@codingame/monaco-vscode-files-service-override';

import { call } from '../ipc';
import { toWorkspacePath } from './workspace-root';

const notFound = (uri: URI): Error =>
	FileSystemProviderError.create(
		`Not in the open folder: ${uri.fsPath}`,
		FileSystemProviderErrorCode.FileNotFound,
	);
const readOnly = (): Error =>
	FileSystemProviderError.create('Read-only', FileSystemProviderErrorCode.NoPermissions);

/**
 * Read-only view of the open folder for VS Code's file service, so language features that open
 * other files (go to definition, peek) can load them. Reads go through main's path-guarded
 * `fs:` channels; files outside the folder stay invisible.
 */
export class WorkspaceFileSystem implements IFileSystemProviderWithFileReadWriteCapability {
	readonly capabilities =
		FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.Readonly;
	private readonly never = new Emitter<never>();
	readonly onDidChangeCapabilities = this.never.event;
	readonly onDidChangeFile = this.never.event;

	watch(): IDisposable {
		return Disposable.None;
	}

	async stat(resource: URI): Promise<IStat> {
		const rel = toWorkspacePath(resource);
		if (rel === null) throw notFound(resource);
		try {
			const file = await call('fs:readFile', rel);
			return {
				type: FileType.File,
				ctime: file.mtimeMs,
				mtime: file.mtimeMs,
				size: file.content.length,
			};
		} catch {
			try {
				await call('fs:list', rel);
				return { type: FileType.Directory, ctime: 0, mtime: 0, size: 0 };
			} catch {
				throw notFound(resource);
			}
		}
	}

	async readFile(resource: URI): Promise<Uint8Array> {
		const rel = toWorkspacePath(resource);
		if (rel === null) throw notFound(resource);
		const file = await call('fs:readFile', rel).catch(() => {
			throw notFound(resource);
		});
		return new TextEncoder().encode(file.content);
	}

	async readdir(resource: URI): Promise<Array<[string, FileType]>> {
		const rel = toWorkspacePath(resource);
		if (rel === null) throw notFound(resource);
		const entries = await call('fs:list', rel);
		return entries.map((e) => [e.name, e.kind === 'dir' ? FileType.Directory : FileType.File]);
	}

	writeFile(): Promise<void> {
		return Promise.reject(readOnly());
	}
	mkdir(): Promise<void> {
		return Promise.reject(readOnly());
	}
	delete(): Promise<void> {
		return Promise.reject(readOnly());
	}
	rename(): Promise<void> {
		return Promise.reject(readOnly());
	}
}
