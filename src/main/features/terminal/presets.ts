import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { TerminalPreset, TerminalPresetId } from '@shared/ipc/channels/terminal';

import { activatedEnv, replEnv } from '../python/interpreter';

export interface LaunchSpec {
	file: string;
	args: string[];
	env: Record<string, string>;
	title: string;
}

const WIN = process.platform === 'win32';

const CLI_PRESETS: Record<
	'claude' | 'codex' | 'gemini',
	{ label: string; command: string; hint: string }
> = {
	claude: {
		label: 'Claude Code',
		command: 'claude',
		hint: 'npm install -g @anthropic-ai/claude-code',
	},
	codex: { label: 'Codex CLI', command: 'codex', hint: 'npm install -g @openai/codex' },
	gemini: { label: 'Gemini CLI', command: 'gemini', hint: 'npm install -g @google/gemini-cli' },
};

/**
 * Resolves a command on PATH via where.exe (Windows) / which. Hits are cached briefly; misses
 * are not, so "Check again" sees a CLI the user has just installed.
 */
const whichCache = new Map<string, { at: number; path: string }>();
export function which(command: string): Promise<string | null> {
	const hit = whichCache.get(command);
	if (hit && Date.now() - hit.at < 30_000) return Promise.resolve(hit.path);
	const tool = WIN ? 'where.exe' : 'which';
	return new Promise((resolve) => {
		execFile(tool, [command], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
			const path = error ? null : (stdout.split(/\r?\n/).find((l) => l.trim()) ?? null);
			if (path) whichCache.set(command, { at: Date.now(), path });
			else whichCache.delete(command);
			resolve(path);
		});
	});
}

async function shell(): Promise<string> {
	if (!WIN) return process.env['SHELL'] ?? '/bin/bash';
	// PowerShell 7 if installed, otherwise the built-in Windows PowerShell 5.1.
	return (await which('pwsh.exe')) ? 'pwsh.exe' : 'powershell.exe';
}

function gitBash(): string | null {
	const roots = [
		process.env['ProgramFiles'],
		process.env['ProgramW6432'],
		process.env['LOCALAPPDATA'],
	];
	for (const root of roots) {
		if (!root) continue;
		for (const rel of ['Git\\bin\\bash.exe', 'Programs\\Git\\bin\\bash.exe']) {
			const p = join(root, rel);
			if (existsSync(p)) return p;
		}
	}
	return null;
}

const available = (id: TerminalPresetId, label: string): TerminalPreset => ({
	id,
	label,
	available: true,
	installHint: null,
	reason: null,
});

export async function listPresets(python: string | null): Promise<TerminalPreset[]> {
	const clis = await Promise.all(
		(Object.keys(CLI_PRESETS) as Array<keyof typeof CLI_PRESETS>).map(async (id) => {
			const p = CLI_PRESETS[id];
			const found = await which(p.command);
			return {
				id,
				label: p.label,
				available: Boolean(found),
				installHint: found ? null : p.hint,
				reason: found ? null : `"${p.command}" was not found on PATH.`,
			};
		}),
	);
	const noPython = {
		available: false,
		installHint: 'uv venv',
		reason: 'No Python interpreter found. Create a venv or install Python.',
	};
	const bash = WIN ? gitBash() : null;
	return [
		available('powershell', WIN ? 'PowerShell' : 'Shell'),
		...(WIN ? [available('cmd', 'Command Prompt')] : []),
		...(WIN
			? [
					bash
						? available('gitbash', 'Git Bash')
						: {
								id: 'gitbash' as const,
								label: 'Git Bash',
								available: false,
								installHint: 'winget install Git.Git',
								reason: 'Git for Windows is not installed.',
							},
				]
			: []),
		python
			? available('python', 'Python env shell')
			: { id: 'python', label: 'Python env shell', ...noPython },
		python
			? available('repl', 'Python REPL')
			: { id: 'repl', label: 'Python REPL', ...noPython },
		...clis,
	];
}

const BASE_ENV = { TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Anvil' };

function clean(env: NodeJS.ProcessEnv): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v;
	return out;
}

/**
 * Builds the process to spawn. Only these fixed presets can be launched from the UI; the
 * renderer never supplies a command line (commands it runs are typed into a shell instead).
 */
export async function launchSpec(
	preset: TerminalPresetId,
	python: string | null,
	ipython: boolean,
): Promise<LaunchSpec> {
	const sh = await shell();
	const noLogo = WIN ? ['-NoLogo'] : [];
	const withPython = (): Record<string, string> =>
		python ? { ...clean(activatedEnv(python)), ...BASE_ENV } : BASE_ENV;
	switch (preset) {
		case 'powershell':
			return {
				file: sh,
				args: noLogo,
				env: withPython(),
				title: WIN ? 'PowerShell' : 'Shell',
			};
		case 'cmd':
			return { file: 'cmd.exe', args: [], env: BASE_ENV, title: 'cmd' };
		case 'gitbash': {
			const bash = gitBash();
			if (!bash) throw new Error('Git Bash is not installed');
			return { file: bash, args: ['--login', '-i'], env: BASE_ENV, title: 'Git Bash' };
		}
		case 'python':
			if (!python) throw new Error('No Python interpreter found');
			return { file: sh, args: noLogo, env: withPython(), title: 'Python env' };
		case 'repl':
			if (!python) throw new Error('No Python interpreter found');
			return {
				file: python,
				// -i keeps plain python interactive; IPython gets a calm, pasteable prompt.
				args: ipython ? ['-m', 'IPython', '--no-banner', '--colors=Linux'] : ['-i', '-q'],
				env: { ...withPython(), ...replEnv(), PYTHONUNBUFFERED: '1' },
				title: ipython ? 'IPython' : 'Python REPL',
			};
		default: {
			const p = CLI_PRESETS[preset];
			// Run inside the shell so you land back at a prompt when the CLI exits.
			const args = WIN
				? [...noLogo, '-NoExit', '-Command', p.command]
				: ['-c', `${p.command}; exec ${sh}`];
			return { file: sh, args, env: withPython(), title: p.label };
		}
	}
}
