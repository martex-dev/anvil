import type { AiContext, AiMode } from '@shared/ipc/channels/ai';

const PERSONA = `You are the coding assistant built into Anvil, a desktop code editor used for Python, TypeScript, quantitative finance, trading systems, crypto, machine learning and data science.
Be direct and concise. Prefer vectorised pandas/polars/NumPy over Python loops, keep financial math explicit about units (returns vs log returns, bps, annualisation), avoid look-ahead bias in anything that touches time series, and never hardcode API keys, private keys or seed phrases.`;

const MODES: Record<AiMode, string> = {
	chat: `${PERSONA}
When you change code, reply with complete code blocks tagged with their language; Anvil shows them with an "Apply" button that opens a diff preview, so prefer returning the full updated selection or file rather than fragments.`,
	edit: `${PERSONA}
You are editing code in place. The user's message is an instruction about the <context kind="selection"> block (or the cursor position when the selection is empty).
Reply with ONLY the code that replaces the selection, in one fenced code block, with the original indentation. No explanation before or after it.`,
	commit: `You write git commit messages in the Conventional Commits style.
Reply with ONLY the message: a subject line under 72 characters in the imperative mood (e.g. "feat(backtest): add slippage model"), then optionally a blank line and a short body explaining why. No code fences, no quotes.`,
};

function fenced(c: AiContext): string {
	// Longer fences than any in the content keep nested code blocks intact.
	const longest = Math.max(2, ...[...c.text.matchAll(/`+/g)].map((m) => m[0].length));
	const fence = '`'.repeat(longest + 1);
	const label = c.label.replace(/"/g, "'");
	return `<context kind="${c.kind}" label="${label}">\n${fence}${c.language ?? ''}\n${c.text}\n${fence}\n</context>`;
}

/** System prompt: the mode's instructions plus every attached context item, clearly delimited. */
export function buildSystem(context: AiContext[], mode: AiMode = 'chat'): string {
	const base = MODES[mode];
	if (context.length === 0) return base;
	return `${base}\n\nThe user attached this context:\n\n${context.map(fenced).join('\n\n')}`;
}
