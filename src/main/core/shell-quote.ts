/** PowerShell single-quoted literal: only ' needs escaping (as ''). */
export const psQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** POSIX shell single-quoted literal: close, add an escaped ', reopen. */
export const shQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * One argument for a command typed into the terminal's shell (PowerShell on Windows, the
 * user's $SHELL elsewhere). Plain words stay readable; anything else is quoted.
 */
export function shellWord(s: string, windows = process.platform === 'win32'): string {
	if (/^[\w:.-]+$/.test(s)) return s;
	return windows ? psQuote(s) : shQuote(s);
}
