import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import { AnvilError } from '../errors';

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
		/** Called once when an unreadable file was moved aside; saved keys must be re-entered. */
		private readonly onReset: () => void = () => undefined,
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
		file.entries[key] = this.encryptor.encryptString(value).toString('base64');
		this.save(file);
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
		if (!existsSync(this.filePath)) {
			this.cache = { version: 1, entries: {} };
			return this.cache;
		}
		try {
			const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<SecretsFile>;
			const entries =
				parsed && typeof parsed.entries === 'object' && parsed.entries !== null
					? parsed.entries
					: {};
			this.cache = { version: 1, entries: { ...entries } };
		} catch {
			// Unreadable (truncated write, disk error): refusing every call would leave no way to
			// re-save a key, so keep the file for inspection and start empty. The parse error is
			// not passed on because its message can quote file contents.
			try {
				renameSync(this.filePath, `${this.filePath}.corrupt`);
			} catch {
				// Best effort only; the next save replaces the file anyway.
			}
			this.cache = { version: 1, entries: {} };
			this.onReset();
		}
		return this.cache;
	}

	private save(file: SecretsFile): void {
		// Write-then-rename so a crash mid-write can't leave a truncated file.
		const tmp = `${this.filePath}.tmp`;
		writeFileSync(tmp, JSON.stringify(file), { encoding: 'utf8', mode: 0o600 });
		renameSync(tmp, this.filePath);
		this.cache = file;
	}
}
