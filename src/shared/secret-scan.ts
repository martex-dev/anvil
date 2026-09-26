import { z } from 'zod';

/**
 * Finds credentials in text: API keys, private keys, wallet keypairs, seed phrases.
 * Shared by the editor (squiggles + blur) and git (blocks a commit that stages one).
 * Heuristic by nature: rules that look at a value alone must be very specific; looser rules
 * also require a telling variable name next to the value.
 */

export const SecretFindingSchema = z.object({
	/** Workspace-relative file, when scanning a diff. */
	path: z.string().nullable(),
	/** 1-based. */
	line: z.number().int(),
	/** 1-based, UTF-16. */
	column: z.number().int(),
	length: z.number().int(),
	kind: z.string(),
	severity: z.enum(['high', 'warn']),
	/** The match with its middle masked, safe to show and log. */
	preview: z.string(),
});
export type SecretFinding = z.infer<typeof SecretFindingSchema>;

interface Rule {
	kind: string;
	severity: 'high' | 'warn';
	pattern: RegExp;
	/** Capture group holding the secret itself (default: the whole match). */
	group?: number;
	/** Keyed on a variable name: the whole identifier must name a credential (isCredentialName). */
	named?: true;
}

const NAME = String.raw`(?:priv(?:ate)?[_-]?key|secret|mnemonic|seed(?:[_-]?phrase)?|api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|pk)`;

const RULES: readonly Rule[] = [
	{
		kind: 'Private key block',
		severity: 'high',
		pattern:
			/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
	},
	{ kind: 'Anthropic API key', severity: 'high', pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}/g },
	{
		kind: 'OpenAI API key',
		severity: 'high',
		pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g,
	},
	{ kind: 'AWS access key id', severity: 'high', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
	{
		kind: 'GitHub token',
		severity: 'high',
		pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g,
	},
	{ kind: 'Google API key', severity: 'high', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
	{ kind: 'Slack token', severity: 'high', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
	{ kind: 'Stripe live key', severity: 'high', pattern: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/g },
	{
		kind: 'Telegram bot token',
		severity: 'high',
		pattern: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g,
	},
	{
		// solana-keygen's keypair.json: 64 bytes as a JSON array.
		kind: 'Solana keypair bytes',
		severity: 'high',
		pattern: /\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/g,
	},
	{
		// A base58-encoded 64-byte secret key is 86–88 characters; nothing else in code is.
		kind: 'Solana secret key (base58)',
		severity: 'high',
		pattern: /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{86,88}(?![1-9A-HJ-NP-Za-km-z])/g,
	},
	{
		// 0x + 64 hex is also a tx hash, so only flag it next to a key-ish name.
		kind: 'EVM private key',
		severity: 'high',
		pattern: new RegExp(String.raw`${NAME}\w*["']?\s*[:=]\s*["']?(0x[a-fA-F0-9]{64})\b`, 'gi'),
		group: 1,
		named: true,
	},
	{
		kind: 'Seed phrase',
		severity: 'high',
		pattern: new RegExp(
			String.raw`${NAME}\w*["']?\s*[:=]\s*["']((?:[a-z]{3,8}\s+){11}(?:[a-z]{3,8}\s+){0,12}[a-z]{3,8})["']`,
			'gi',
		),
		group: 1,
		named: true,
	},
	{
		kind: 'Hardcoded credential',
		severity: 'warn',
		pattern: new RegExp(String.raw`${NAME}\w*["']?\s*[:=]\s*["']([^"'\s$\{]{16,})["']`, 'gi'),
		group: 1,
		named: true,
	},
];

/** Keeps a few characters at both ends so you can recognise which key it is. */
export function maskSecret(secret: string): string {
	if (secret.length <= 10) return '•'.repeat(secret.length);
	return `${secret.slice(0, 4)}${'•'.repeat(Math.min(12, secret.length - 8))}${secret.slice(-4)}`;
}

function isPlaceholder(value: string): boolean {
	return /^(?:x+|\*+|\.+|your[_-]|<|changeme|example|placeholder|test|dummy)/i.test(value);
}

/** A web address without credentials, or a file path: config, not a secret. */
function isUrlOrPath(value: string): boolean {
	return /^(?:https?:\/\/[^@\s]*$|\.{0,2}\/|~\/|[A-Za-z]:[\\/])/.test(value);
}

const CREDENTIAL_WORDS = new Set([
	'secret',
	'mnemonic',
	'password',
	'passwd',
	'pk',
	'privkey',
	'privatekey',
	'apikey',
	'seedphrase',
]);
const CREDENTIAL_PAIRS = new Set([
	'priv key',
	'private key',
	'api key',
	'access token',
	'auth token',
]);

/**
 * Whether a whole identifier names a credential, judged by its words (snake, kebab or camel
 * case), so `client_secret` and `walletPrivateKey` count but `pkg_index_url`, `secretary` and
 * `seed_file` don't. A bare `seed` counts only as the last word (`wallet_seed`, `seed_phrase`).
 */
export function isCredentialName(identifier: string): boolean {
	const words = identifier
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toLowerCase()
		.split(/[_-]+/)
		.filter(Boolean);
	return words.some((word, i) => {
		const next = words[i + 1];
		if (CREDENTIAL_WORDS.has(word)) return true;
		if (next !== undefined && CREDENTIAL_PAIRS.has(`${word} ${next}`)) return true;
		return word === 'seed' && (next === undefined || next === 'phrase');
	});
}

/** The identifier around `offset`: letters, digits, `_` and `-` on both sides. */
function identifierAt(text: string, offset: number): string {
	let start = offset;
	while (start > 0 && /[\w-]/.test(text[start - 1] ?? '')) start--;
	let end = offset;
	while (end < text.length && /[\w-]/.test(text[end] ?? '')) end++;
	return text.slice(start, end);
}

export function scanText(text: string, path: string | null = null): SecretFinding[] {
	const findings: SecretFinding[] = [];
	const lineStarts = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
	const position = (offset: number): { line: number; column: number } => {
		let lo = 0;
		let hi = lineStarts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
			else hi = mid - 1;
		}
		return { line: lo + 1, column: offset - (lineStarts[lo] ?? 0) + 1 };
	};
	const taken: Array<[number, number]> = [];
	for (const rule of RULES) {
		for (const match of text.matchAll(rule.pattern)) {
			const secret = rule.group ? match[rule.group] : match[0];
			if (!secret || match.index === undefined) continue;
			const start = match.index + match[0].indexOf(secret);
			const end = start + secret.length;
			// A specific rule already covered this span; don't report it twice.
			if (taken.some(([a, b]) => start < b && end > a)) continue;
			if (rule.named && !isCredentialName(identifierAt(text, match.index))) continue;
			if (rule.severity === 'warn' && (isPlaceholder(secret) || isUrlOrPath(secret)))
				continue;
			taken.push([start, end]);
			findings.push({
				path,
				...position(start),
				length: secret.length,
				kind: rule.kind,
				severity: rule.severity,
				preview: maskSecret(secret),
			});
		}
	}
	return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** Only the added lines of a unified diff, attributed to their file and new line number. */
export function scanUnifiedDiff(diff: string): SecretFinding[] {
	const findings: SecretFinding[] = [];
	let file: string | null = null;
	let line = 0;
	for (const raw of diff.split('\n')) {
		if (raw.startsWith('+++ ')) {
			file = raw.slice(4).replace(/^b\//, '').trim();
			if (file === '/dev/null') file = null;
			continue;
		}
		const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
		if (hunk) {
			line = Number(hunk[1]);
			continue;
		}
		if (raw.startsWith('+') && !raw.startsWith('+++')) {
			for (const f of scanText(raw.slice(1), file)) findings.push({ ...f, line });
			line++;
		} else if (!raw.startsWith('-')) {
			line++;
		}
	}
	return findings;
}

/** `.env`-style files, whose values are all secret-ish and get blurred by the shield. */
export function isEnvFile(path: string): boolean {
	const name = path.split('/').at(-1)?.toLowerCase() ?? '';
	return name === '.env' || name.startsWith('.env.') || name.endsWith('.env');
}
