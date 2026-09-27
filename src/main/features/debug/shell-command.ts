import { psQuote, shQuote } from '../../core/shell-quote';

/**
 * Turns a DAP `runInTerminal` request (an argument list, extra environment and a folder) into
 * one line typed into Anvil's terminal: PowerShell on Windows, a POSIX shell elsewhere.
 */

export interface RunInTerminalArgs {
	args: string[];
	env?: Record<string, string | null> | undefined;
	cwd?: string | undefined;
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertOneLine(value: string): void {
	// A line break typed into a shell would run the command early, cut in two.
	if (/[\r\n]/.test(value)) throw new Error('Terminal arguments cannot contain line breaks');
}

export function terminalCommand(
	request: RunInTerminalArgs,
	platform: NodeJS.Platform = process.platform,
): string {
	if (request.args.length === 0) throw new Error('runInTerminal without a command');
	const values = [...request.args, request.cwd ?? '', ...Object.values(request.env ?? {})];
	for (const value of values) if (value !== null) assertOneLine(value);
	// Names that aren't plain identifiers could smuggle shell syntax into `$env:<name>`.
	const env = Object.entries(request.env ?? {}).filter(([name]) => ENV_NAME.test(name));

	if (platform === 'win32') {
		const parts: string[] = [];
		if (request.cwd) parts.push(`Set-Location -LiteralPath ${psQuote(request.cwd)}`);
		for (const [name, value] of env) {
			parts.push(
				value === null
					? `Remove-Item Env:${name} -ErrorAction SilentlyContinue`
					: `$env:${name}=${psQuote(value)}`,
			);
		}
		// The call operator runs a quoted executable path (paths often contain spaces here).
		parts.push(`& ${request.args.map(psQuote).join(' ')}`);
		return parts.join('; ');
	}
	const prefix = env
		.map(([name, value]) => (value === null ? '' : `${name}=${shQuote(value)} `))
		.join('');
	const unset = env.filter(([, value]) => value === null).map(([name]) => `unset ${name}; `);
	const command = `${unset.join('')}${prefix}${request.args.map(shQuote).join(' ')}`;
	return request.cwd ? `cd -- ${shQuote(request.cwd)} && ${command}` : command;
}
