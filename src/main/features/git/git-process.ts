import { type SimpleGit, simpleGit } from 'simple-git';

/**
 * Environment for git: an allowlist of what git and Git Credential Manager need. Inheriting
 * everything would leak other tools' hooks (GIT_ASKPASS from VS Code, EDITOR, PAGER…), which
 * simple-git also refuses to run with.
 */
const ENV_ALLOW = new Set(
	[
		'PATH',
		'PATHEXT',
		'SystemRoot',
		'SystemDrive',
		'windir',
		'ComSpec',
		'TEMP',
		'TMP',
		'HOME',
		'HOMEDRIVE',
		'HOMEPATH',
		'USERPROFILE',
		'USERNAME',
		'USERDOMAIN',
		'APPDATA',
		'LOCALAPPDATA',
		'ProgramData',
		'ProgramFiles',
		'ProgramFiles(x86)',
		'ProgramW6432',
		'CommonProgramFiles',
		'LANG',
		'SSH_AUTH_SOCK',
		// The user's SSH client (PuTTY's plink via GIT_SSH, set by TortoiseGit/PuTTY installers).
		'GIT_SSH',
		'GIT_SSH_COMMAND',
		'GIT_SSH_VARIANT',
		// Where git (and GPG for signed commits) find the user's config and identity on Linux.
		'XDG_CONFIG_HOME',
		'GNUPGHOME',
		// Git Credential Manager / askpass windows on Linux.
		'DISPLAY',
		'WAYLAND_DISPLAY',
		'HTTP_PROXY',
		'HTTPS_PROXY',
		'NO_PROXY',
		'http_proxy',
		'https_proxy',
		'no_proxy',
	].map((k) => k.toLowerCase()),
);

export function gitEnv(env: NodeJS.ProcessEnv): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) continue;
		// Windows env names are case-insensitive; GCM_* configures Git Credential Manager.
		if (ENV_ALLOW.has(key.toLowerCase()) || key.startsWith('GCM_') || key.startsWith('LC_')) {
			out[key] = value;
		}
	}
	// Anvil parses git's messages ("not a git repository"), so they must stay in English.
	// LC_ALL would override LC_MESSAGES; keep its character set as LC_CTYPE so non-ASCII paths
	// are still encoded the same way.
	const all = out['LC_ALL'];
	delete out['LC_ALL'];
	if (all !== undefined && out['LC_CTYPE'] === undefined) out['LC_CTYPE'] = all;
	return { ...out, LC_MESSAGES: 'C', GIT_TERMINAL_PROMPT: '0' };
}

export function git(baseDir: string): SimpleGit {
	return simpleGit({
		baseDir,
		maxConcurrentProcesses: 4,
		timeout: { block: 60_000 },
		// GIT_TERMINAL_PROMPT=0: never hang on a prompt in an invisible terminal; Git
		// Credential Manager still shows its own window when credentials are needed.
	}).env(gitEnv(process.env));
}

/**
 * Splits paths into argv batches. Windows caps a command line at 32 767 characters, and
 * Stage All can send thousands of long paths; 8 000 leaves room for git's own arguments.
 */
export function batchPaths(paths: readonly string[], maxChars = 8_000): string[][] {
	const batches: string[][] = [];
	let batch: string[] = [];
	let size = 0;
	for (const p of paths) {
		// +3: separating space and quotes Node adds around arguments with spaces.
		const cost = p.length + 3;
		if (batch.length > 0 && size + cost > maxChars) {
			batches.push(batch);
			batch = [];
			size = 0;
		}
		batch.push(p);
		size += cost;
	}
	if (batch.length > 0) batches.push(batch);
	return batches;
}

/** git's "not a git repository" failure (messages are forced to English by gitEnv). */
export function isNotARepo(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /not a git repository/i.test(message);
}

/**
 * git failures that only mean "this path has no version there": untracked, new, deleted or
 * conflicted files, no commits yet, or a blame line past the committed end. Matched on
 * English text, which gitEnv guarantees.
 */
const MISSING_PATH =
	/invalid object name 'HEAD'|no such ref: HEAD|does not exist|exists on disk, but not in|is in the index, but not at stage|no such path|has only \d+ lines?/i;

export function isMissingPathError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return MISSING_PATH.test(message);
}
