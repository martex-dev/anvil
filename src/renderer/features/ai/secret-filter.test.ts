import { describe, expect, it } from 'vitest';

import { hasSecrets, isSecretFile, maskSecrets, safeContext } from './secret-filter';

const KEY = `sk-ant-${'a1B2'.repeat(10)}`;

describe('isSecretFile', () => {
	it('knows files that hold credentials by nature', () => {
		for (const path of [
			'.env',
			'config/.env.local',
			'prod.env',
			'certs/server.pem',
			'tls.key',
			'id_rsa',
			'.ssh/id_ed25519',
			'wallet-keypair.json',
			'secrets.yaml',
			'credentials.json',
			'.netrc',
		])
			expect(isSecretFile(path), path).toBe(true);
	});

	it('leaves ordinary code and data alone', () => {
		for (const path of [
			'main.py',
			'keys.py',
			'env.py',
			'secretary.md',
			'data/prices.json',
			'id_rsa.pub',
		])
			expect(isSecretFile(path), path).toBe(false);
	});
});

describe('maskSecrets', () => {
	it('masks what the scanner finds and keeps the text length', () => {
		const text = `client = Anthropic(api_key="${KEY}")\nprint(1)\n`;
		const { text: out, masked } = maskSecrets(text);
		expect(masked).toBe(1);
		expect(out).not.toContain(KEY);
		expect(out).toHaveLength(text.length);
		expect(out).toContain('sk-a•');
		expect(out.endsWith('print(1)\n')).toBe(true);
	});

	it('masks every value of a dotenv file, comments and keys kept', () => {
		const { text, masked } = maskSecrets(
			'# db\nDB_PASSWORD=hunter2\nexport TOKEN="abc"\r\n',
			'.env',
		);
		expect(text).toBe('# db\nDB_PASSWORD=•••••••\nexport TOKEN=•••••\r\n');
		expect(masked).toBe(2);
	});

	it('masks the body of a private key block, not just its header', () => {
		const block =
			'-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\nkqhkiG9w0BAQEF\n-----END PRIVATE KEY-----\n';
		const { text } = maskSecrets(`x = 1\n${block}`);
		expect(text).not.toContain('MIIEvQ');
		expect(text).toContain('-----BEGIN PRIVATE KEY-----\n••••••••••••••\n');
		expect(text).toContain('-----END PRIVATE KEY-----');
	});

	it('returns clean text unchanged', () => {
		expect(maskSecrets('x = 1\n')).toEqual({ text: 'x = 1\n', masked: 0 });
		expect(hasSecrets('x = 1\n')).toBe(false);
		expect(hasSecrets(`KEY = "${KEY}"`)).toBe(true);
	});
});

describe('safeContext', () => {
	it('withholds a key file and masks secrets in code', () => {
		const pem = safeContext({ kind: 'file', label: 'server.pem', language: null, text: 'x' });
		expect(pem.item.text).toMatch(/withheld/);
		expect(pem.hidden).toBe(1);

		const code = safeContext({
			kind: 'selection',
			label: 'app.py:3-4',
			language: 'python',
			text: `key = "${KEY}"`,
		});
		expect(code.item.text).not.toContain(KEY);
		expect(code.hidden).toBe(1);
	});

	it('masks the values of a selection taken from a dotenv file', () => {
		const env = safeContext({
			kind: 'selection',
			label: '.env:1-1',
			language: null,
			text: 'PASSWORD=hunter2',
		});
		expect(env.item.text).toBe('PASSWORD=•••••••');
	});
});
