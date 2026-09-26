/** A secret Anvil can store. The value only ever lives in main (SecretsService). */
export interface SecretSpec {
	/** Stable storage key. */
	key: string;
	label: string;
	/** Where to get it, shown in Settings → Keys. */
	help: string;
}

export const SECRET_SPECS: readonly SecretSpec[] = [
	{
		key: 'anthropic.key',
		label: 'Anthropic API key',
		help: 'console.anthropic.com → API keys. Powers Claude in chat, inline edit and autocomplete.',
	},
	{
		key: 'openai.key',
		label: 'OpenAI API key',
		help: 'platform.openai.com → API keys.',
	},
	{
		key: 'gemini.key',
		label: 'Google Gemini API key',
		help: 'aistudio.google.com → Get API key.',
	},
];

export function isKnownSecret(key: string): boolean {
	return SECRET_SPECS.some((s) => s.key === key);
}
