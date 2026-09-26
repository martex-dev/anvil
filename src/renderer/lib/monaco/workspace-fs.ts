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
const unreadable = (uri: URI, why: string, code: FileSystemProviderErrorCode): Error =>
	FileSystemProviderError.create(`Can't open ${uri.fsPath}: the file is ${why}`, code);
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
		// Metadata only: reading a file (up to 5 MB over IPC) just to stat it made peeks slow.
		const s = await call('fs:stat', rel).catch(() => {
			throw notFound(resource);
		});
		return {
			type: s.kind === 'dir' ? FileType.Directory : FileType.File,
			ctime: s.ctimeMs,
			mtime: s.mtimeMs,
			size: s.size,
		};
	}

	async readFile(resource: URI): Promise<Uint8Array> {
		const rel = toWorkspacePath(resource);
		if (rel === null) throw notFound(resource);
		const file = await call('fs:readFile', rel).catch(() => {
			throw notFound(resource);
		});
		// Main sends no content for these; returning empty bytes would show the file as empty.
		if (file.tooLarge)
			throw unreadable(resource, 'too large', FileSystemProviderErrorCode.FileTooLarge);
		if (file.binary)
			throw unreadable(resource, 'binary', FileSystemProviderErrorCode.Unavailable);
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
