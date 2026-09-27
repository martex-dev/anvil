import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as JsonFileModule from '../store/json-file';
import { type Encryptor, SecretsService } from './secrets-service';

// Lets a test make secrets.json unreadable, like a file a scanner or backup tool holds open.
const lock = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock('../store/json-file', async (importOriginal) => {
	const actual = await importOriginal<typeof JsonFileModule>();
	return {
		...actual,
		readJsonFile: (path: string): JsonFileModule.JsonFile => {
			if (lock.error) throw lock.error;
			return actual.readJsonFile(path, []);
		},
	};
});

// Reversible fake that visibly transforms the value so plaintext never appears on disk.
const fakeEncryptor: Encryptor = {
	isEncryptionAvailable: () => true,
	encryptString: (plain) => Buffer.from([...Buffer.from(plain, 'utf8')].map((b) => b ^ 0x5a)),
	decryptString: (buf) => Buffer.from([...buf].map((b) => b ^ 0x5a)).toString('utf8'),
};

const SECRET = 'ghp_SuperSecretValue_1234567890';
let dir: string;
let file: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-secrets-'));
	file = join(dir, 'secrets.json');
});
afterEach(() => {
	lock.error = null;
	rmSync(dir, { recursive: true, force: true });
});

const corruptCopies = (): string[] => readdirSync(dir).filter((n) => n.includes('.corrupt-'));

const allowed = (key: string): boolean => key === 'github.token';

describe('SecretsService', () => {
	it('stores, reports and retrieves a secret without writing plaintext', () => {
		const svc = new SecretsService(file, fakeEncryptor, allowed);
		expect(svc.has('github.token')).toBe(false);
		svc.set('github.token', SECRET);
		expect(svc.has('github.token')).toBe(true);
		expect(svc.get('github.token')).toBe(SECRET);
		expect(readFileSync(file, 'utf8')).not.toContain(SECRET);
	});

	it('survives a restart (new instance, same file)', () => {
		new SecretsService(file, fakeEncryptor, allowed).set('github.token', SECRET);
		const again = new SecretsService(file, fakeEncryptor, allowed);
		expect(again.savedKeys()).toEqual(['github.token']);
		expect(again.get('github.token')).toBe(SECRET);
	});

	it('deletes', () => {
		const svc = new SecretsService(file, fakeEncryptor, allowed);
		svc.set('github.token', SECRET);
		svc.delete('github.token');
		expect(svc.has('github.token')).toBe(false);
		expect(svc.get('github.token')).toBeNull();
	});

	it('rejects undeclared keys and never echoes the value in errors', () => {
		const svc = new SecretsService(file, fakeEncryptor, allowed);
		let message = '';
		try {
			svc.set('random.key', SECRET);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toMatch(/not a secret/);
		expect(message).not.toContain(SECRET);
	});

	it('refuses to store when OS encryption is unavailable', () => {
		const svc = new SecretsService(
			file,
			{ ...fakeEncryptor, isEncryptionAvailable: () => false },
			allowed,
		);
		expect(() => svc.set('github.token', SECRET)).toThrow(/unavailable/);
	});

	it('recovers from a corrupt file so keys can be saved again', () => {
		writeFileSync(file, '{"version":1,"entries":{"github.tok');
		let resets = 0;
		const svc = new SecretsService(file, fakeEncryptor, allowed, () => resets++);
		expect(svc.savedKeys()).toEqual([]);
		expect(corruptCopies()).toHaveLength(1);
		svc.set('github.token', SECRET);
		expect(new SecretsService(file, fakeEncryptor, allowed).get('github.token')).toBe(SECRET);
		expect(resets).toBe(1);
	});

	it('does not report a key as saved when writing the file failed', () => {
		const svc = new SecretsService(file, fakeEncryptor, allowed);
		// A folder where the temp file goes makes the write fail.
		mkdirSync(`${file}.tmp`);
		expect(() => svc.set('github.token', SECRET)).toThrow(
			expect.objectContaining({ code: 'SECRETS_SAVE_FAILED' }),
		);
		expect(svc.has('github.token')).toBe(false);
	});

	it('leaves a locked file alone and reads it once it is free', () => {
		new SecretsService(file, fakeEncryptor, allowed).set('github.token', SECRET);
		const resets = vi.fn();
		const svc = new SecretsService(file, fakeEncryptor, allowed, resets);
		lock.error = Object.assign(new Error('EBUSY: locked'), { code: 'EBUSY' });
		expect(() => svc.savedKeys()).toThrow(
			expect.objectContaining({ code: 'SECRETS_UNREADABLE' }),
		);
		expect(corruptCopies()).toEqual([]);
		expect(resets).not.toHaveBeenCalled();
		lock.error = null;
		expect(svc.get('github.token')).toBe(SECRET);
	});

	it('reads a file saved with a UTF-8 BOM', () => {
		new SecretsService(file, fakeEncryptor, allowed).set('github.token', SECRET);
		writeFileSync(file, `\ufeff${readFileSync(file, 'utf8')}`, 'utf8');
		expect(new SecretsService(file, fakeEncryptor, allowed).get('github.token')).toBe(SECRET);
		expect(corruptCopies()).toEqual([]);
	});
});
