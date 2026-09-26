import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Encryptor, SecretsService } from './secrets-service';

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
afterEach(() => rmSync(dir, { recursive: true, force: true }));

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
});
