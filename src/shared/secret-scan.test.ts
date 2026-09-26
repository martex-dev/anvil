import { describe, expect, it } from 'vitest';

import { isEnvFile, maskSecret, scanText, scanUnifiedDiff } from './secret-scan';

const kinds = (text: string): string[] => scanText(text).map((f) => f.kind);

describe('scanText', () => {
	it('finds provider API keys', () => {
		expect(kinds(`key = "sk-ant-api03-${'a'.repeat(40)}"`)).toEqual(['Anthropic API key']);
		expect(kinds(`OPENAI = 'sk-proj-${'B'.repeat(40)}'`)).toEqual(['OpenAI API key']);
		expect(kinds(`aws = "${'AKIA'}IOSFODNN7EXAMPLE"`)).toEqual(['AWS access key id']);
		expect(kinds(`t = "ghp_${'x'.repeat(36)}"`)).toEqual(['GitHub token']);
	});

	it('finds PEM private keys', () => {
		expect(kinds('-----BEGIN OPENSSH PRIVATE KEY-----\nabc')).toEqual(['Private key block']);
	});

	it('finds a Solana keypair byte array', () => {
		const bytes = Array.from({ length: 64 }, (_, i) => i * 3).join(', ');
		expect(kinds(`[${bytes}]`)).toEqual(['Solana keypair bytes']);
	});

	it('finds a base58 Solana secret key but not a 44-char public address', () => {
		const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
		const secret = Array.from({ length: 88 }, (_, i) => alphabet[i % 58]).join('');
		expect(kinds(`SECRET = "${secret}"`)).toContain('Solana secret key (base58)');
		expect(kinds('addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"')).toEqual([]);
	});

	it('flags 0x keys only next to a key-ish name', () => {
		const hex = `0x${'ab'.repeat(32)}`;
		expect(kinds(`PRIVATE_KEY = "${hex}"`)).toEqual(['EVM private key']);
		expect(kinds(`tx_hash = "${hex}"`)).toEqual([]);
	});

	it('finds a seed phrase assigned to a telling name', () => {
		const words =
			'abandon ability able about above absent absorb abstract absurd abuse access accident';
		expect(kinds(`mnemonic = "${words}"`)).toEqual(['Seed phrase']);
	});

	it('warns on hardcoded credentials but skips placeholders', () => {
		expect(scanText('password = "hunter2hunter2hunter2"')[0]?.severity).toBe('warn');
		expect(kinds('api_key = "your-api-key-goes-here"')).toEqual([]);
		expect(kinds('api_key = os.environ["API_KEY"]')).toEqual([]);
	});

	it('reports 1-based positions and never the raw value', () => {
		const [f] = scanText(`a = 1\nk = "sk-ant-${'z'.repeat(30)}"`);
		expect(f).toMatchObject({ line: 2, column: 6 });
		expect(f?.preview).not.toContain('z'.repeat(20));
	});
});

describe('scanUnifiedDiff', () => {
	it('attributes findings in added lines to file and new line number', () => {
		const diff = [
			'diff --git a/bot.py b/bot.py',
			'--- a/bot.py',
			'+++ b/bot.py',
			'@@ -1,2 +1,3 @@',
			' import os',
			`+KEY = "sk-ant-${'q'.repeat(30)}"`,
			`-OLD = "sk-ant-${'r'.repeat(30)}"`,
		].join('\n');
		const findings = scanUnifiedDiff(diff);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({ path: 'bot.py', line: 2 });
	});
});

describe('helpers', () => {
	it('masks the middle', () => {
		expect(maskSecret('abcdefghijklmnop')).toBe('abcd••••••••mnop');
	});
	it('recognises env files', () => {
		expect(isEnvFile('.env')).toBe(true);
		expect(isEnvFile('config/.env.local')).toBe(true);
		expect(isEnvFile('prod.env')).toBe(true);
		expect(isEnvFile('env.py')).toBe(false);
	});
});
