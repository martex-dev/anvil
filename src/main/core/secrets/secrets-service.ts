import { renameSync, rmSync, writeFileSync } from 'node:fs';

import { AnvilError } from '../errors';
import { moveAside, readJsonFile } from '../store/json-file';

/** The subset of Electron's safeStorage we use; injectable so tests don't need Electron. */
export interface Encryptor {
	isEncryptionAvailable(): boolean;
	encryptString(plain: string): Buffer;
	decryptString(encrypted: Buffer): string;
}

interface SecretsFile {
	version: 1;
	/** key → base64 ciphertext. Key names are not secret; values never touch disk in plaintext. */
	entries: Record<string, string>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/**
 * Stores secrets encrypted with safeStorage (DPAPI on Windows) in a single file under userData.
 * Error messages and logs must never include a secret value.
 */
export class SecretsService {
	private cache: SecretsFile | null = null;

	constructor(
		private readonly filePath: string,
		private readonly encryptor: Encryptor,
		private readonly isAllowedKey: (key: string) => boolean,
		/**
		 * Called once when a corrupt file was set aside (with the rename's error if even that
		 * failed); saved keys must be re-entered.
		 */
		private readonly onReset: (moveError?: unknown) => void = () => undefined,
	) {}

	has(key: string): boolean {
		return key in this.load().entries;
	}

	savedKeys(): string[] {
		return Object.keys(this.load().entries).sort();
	}

	set(key: string, value: string): void {
		this.assertKey(key);
		if (value.length === 0) throw new AnvilError('SECRET_EMPTY', 'Secret value is empty');
		this.assertAvailable();
		const file = this.load();
		// A copy: if the save fails, the cache must not claim the key is stored.
		const entries = {
			...file.entries,
			[key]: this.encryptor.encryptString(value).toString('base64'),
		};
		this.save({ ...file, entries });
	}

	delete(key: string): void {
		const file = this.load();
		if (!(key in file.entries)) return;
		const { [key]: _removed, ...rest } = file.entries;
		this.save({ ...file, entries: rest });
	}

	/** Main-process only. Never expose through IPC. */
	get(key: string): string | null {
		const encoded = this.load().entries[key];
		if (encoded === undefined) return null;
		this.assertAvailable();
		try {
			return this.encryptor.decryptString(Buffer.from(encoded, 'base64'));
		} catch (error) {
			throw new AnvilError(
				'SECRET_UNREADABLE',
				`Secret "${key}" could not be decrypted`,
				error,
			);
		}
	}

	private assertKey(key: string): void {
		if (!KEY_PATTERN.test(key) || !this.isAllowedKey(key)) {
			throw new AnvilError(
				'SECRET_UNKNOWN_KEY',
				`"${key}" is not a secret any module declares`,
			);
		}
	}

	private assertAvailable(): void {
		if (!this.encryptor.isEncryptionAvailable()) {
			throw new AnvilError(
				'SECRETS_UNAVAILABLE',
				'OS encryption is unavailable, so secrets cannot be stored safely',
			);
		}
	}

	private load(): SecretsFile {
		if (this.cache) return this.cache;
		let file;
		try {
			file = readJsonFile(this.filePath);
		} catch (error) {
			// Locked (a scanner or backup tool) or a failing disk: the file may be fine, so it is
			// neither cached nor replaced. The next call reads it again.
			throw new AnvilError(
				'SECRETS_UNREADABLE',
				'Saved API keys could not be read right now; try again in a moment',
				error,
			);
		}
		if (file.kind === 'missing') {
			this.cache = { version: 1, entries: {} };
			return this.cache;
		}
		const entries = file.kind === 'ok' ? entriesOf(file.value) : null;
		if (entries) {
			this.cache = { version: 1, entries };
			return this.cache;
		}
		// Unparseable (a truncated write): refusing every call would leave no way to re-save a
		// key, so keep the file for inspection and start empty. The parse error is not passed on
		// because its message can quote file contents.
		let moveError: unknown;
		try {
			moveAside(this.filePath);
		} catch (error) {
			moveError = error;
		}
		this.cache = { version: 1, entries: {} };
		this.onReset(moveError);
		return this.cache;
	}

	private save(file: SecretsFile): void {
		// Write-then-rename so a crash mid-write can't leave a truncated file.
		const tmp = `${this.filePath}.tmp`;
		try {
			writeFileSync(tmp, JSON.stringify(file), { encoding: 'utf8', mode: 0o600 });
			renameSync(tmp, this.filePath);
		} catch (error) {
			try {
				rmSync(tmp, { force: true });
			} catch {
				// A leftover temp file is harmless (the next save replaces it); the save's own
				// error is the one to report.
			}
			throw new AnvilError('SECRETS_SAVE_FAILED', 'API keys could not be saved', error);
		}
		this.cache = file;
	}
}

/** The saved entries, or null when the file isn't a secrets file at all. */
function entriesOf(value: unknown): Record<string, string> | null {
	if (typeof value !== 'object' || value === null) return null;
	const entries: unknown = (value as { entries?: unknown }).entries;
	if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) return null;
	return Object.fromEntries(
		Object.entries(entries).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string',
		),
	);
}
