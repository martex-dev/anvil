import { describe, expect, it } from 'vitest';

import {
	isCredentialName,
	isEnvFile,
	maskSecret,
	scanText,
	scanUnifiedDiff,
	unquoteGitPath,
} from './secret-scan';

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

	it('ignores names that only contain a credential word', () => {
		expect(kinds('pkg_index_url = "https://pypi.org/simple/extra"')).toEqual([]);
		expect(kinds('secretary_email = "marto.assistant@example.org"')).toEqual([]);
		expect(kinds('seed_file = "data/seeds/universe_2024.csv"')).toEqual([]);
		expect(kinds('client_secret = "q8Jv2mR7tX4wZ9pL3nB6"')).toEqual(['Hardcoded credential']);
		expect(kinds('walletPrivateKey = "q8Jv2mR7tX4wZ9pL3nB6"')).toEqual([
			'Hardcoded credential',
		]);
	});

	it('does not warn on URLs and paths assigned to credential names', () => {
		expect(kinds('private_key_path = "C:/Users/marto/keys/id.pem"')).toEqual([]);
		expect(kinds('secret_manager_url = "https://vault.example.com/v1"')).toEqual([]);
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

describe('unquoteGitPath', () => {
	it('decodes octal UTF-8 escapes and C escapes', () => {
		expect(
			unquoteGitPath(String.raw`"b/\320\264\320\260\320\275\320\275\321\213\320\265.py"`),
		).toBe('b/данные.py');
		expect(unquoteGitPath(String.raw`"b/say \"hi\"\tnow.py"`)).toBe('b/say "hi"\tnow.py');
		// Unescaped non-ASCII (core.quotePath=false) next to an escaped backslash.
		expect(unquoteGitPath('"b/данные\\\\x.py"')).toBe('b/данные\\x.py');
	});

	it('leaves unquoted paths alone', () => {
		expect(unquoteGitPath('b/bot.py')).toBe('b/bot.py');
	});

	it('gives the real path to findings in quoted diff headers', () => {
		const diff = [
			String.raw`+++ "b/\320\272\320\273\321\216\321\207.py"`,
			'@@ -0,0 +1 @@',
			`+KEY = "sk-ant-${'q'.repeat(30)}"`,
		].join('\n');
		expect(scanUnifiedDiff(diff)[0]).toMatchObject({ path: 'ключ.py', line: 1 });
	});
});

describe('isCredentialName', () => {
	it.each([
		['PRIVATE_KEY', true],
		['apiKey', true],
		['api-key', true],
		['AUTH_TOKEN', true],
		['wallet_seed', true],
		['seed_phrase', true],
		['pk', true],
		['pkg_name', false],
		['secretary', false],
		['seed_file', false],
		['keyboard', false],
	])('%s → %s', (name, expected) => {
		expect(isCredentialName(name)).toBe(expected);
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
