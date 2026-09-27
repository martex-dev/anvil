import { AnvilError } from '../../core/errors';

// Hint lines that are boilerplate rather than advice.
const NOISE =
	/^(see ['"]?git (help|\S+ --help)|disable this message with|turn off this advice by setting)/i;
const MAX_ERROR_LINES = 4;
const MAX_HINT_LINES = 8;

/**
 * git prints the reason as `error:` / `fatal:` lines followed by `hint:` lines. The hints are
 * often the only actionable part ("You have divergent branches… git config pull.rebase false",
 * "Updates were rejected… integrate the remote changes"), so they are kept, after the error
 * itself and without the prefix; only the "how to silence this" boilerplate goes.
 */
export function formatGitError(raw: string): string {
	// A remote URL can carry a token (https://user:token@host/...); it must not reach a toast or log.
	const lines = raw.replace(/(\w+:\/\/)[^@/\s]+@/g, '$1***@').split(/\r?\n/);
	const errors = lines
		.filter((l) => l.trim() && !/^hint:/.test(l))
		.slice(0, MAX_ERROR_LINES)
		.map((l) => l.trimEnd());
	const hints = lines
		.filter((l) => /^hint:/.test(l))
		.map((l) => l.replace(/^hint:\s?/, '').trimEnd())
		.filter((l) => l.trim() && !NOISE.test(l.trim()))
		.slice(0, MAX_HINT_LINES);
	return [errors.join('\n'), hints.join('\n')].filter(Boolean).join('\n\n');
}

export function gitError(error: unknown): AnvilError {
	if (error instanceof AnvilError) return error;
	const raw = error instanceof Error ? error.message : String(error);
	return new AnvilError('GIT_FAILED', formatGitError(raw) || 'git failed', error);
}
