/**
 * Environment for the git processes Anvil starts (the Git view, the AI's "attach diff").
 *
 * It inherits the user's environment, because git and its hooks rely on far more than an
 * allowlist can anticipate: GIT_SSH / GIT_SSH_COMMAND (plink), GNUPGHOME for signed commits,
 * XDG_CONFIG_HOME / GIT_CONFIG_GLOBAL for config, and JAVA_HOME, NODE_OPTIONS, VIRTUAL_ENV or
 * CONDA_* for pre-commit hooks. Only variables that would hijack, stall or confuse git go.
 */

/** Exact names, compared case-insensitively (Windows env names are case-insensitive). */
const STRIP = new Set(
	[
		// Prompts and editors of whichever app launched Anvil (VS Code's askpass pipe is gone once
		// that app closes); git must never wait on an invisible editor or pager either.
		'GIT_ASKPASS',
		'SSH_ASKPASS',
		'SSH_ASKPASS_REQUIRE',
		'GIT_EDITOR',
		'GIT_SEQUENCE_EDITOR',
		'EDITOR',
		'VISUAL',
		'GIT_PAGER',
		'PAGER',
		// Set by a parent git process (Anvil started from a hook or an alias): they would point
		// every command at that other repository, index or config.
		'GIT_DIR',
		'GIT_WORK_TREE',
		'GIT_INDEX_FILE',
		'GIT_OBJECT_DIRECTORY',
		'GIT_ALTERNATE_OBJECT_DIRECTORIES',
		'GIT_COMMON_DIR',
		'GIT_NAMESPACE',
		'GIT_PREFIX',
		'GIT_EXEC_PATH',
		'GIT_CONFIG_PARAMETERS',
		'GIT_CONFIG_COUNT',
		'GIT_EXTERNAL_DIFF',
		'GIT_DIFF_OPTS',
		'GIT_LITERAL_PATHSPECS',
		'GIT_GLOB_PATHSPECS',
		'GIT_NOGLOB_PATHSPECS',
		'GIT_ICASE_PATHSPECS',
		// Anvil parses git's messages ("not a git repository"): they must stay in English.
		'LANGUAGE',
		'LC_MESSAGES',
	].map((k) => k.toLowerCase()),
);

/** VS Code's git IPC, `git -c` pairs from a parent git, and trace output on stderr. */
const STRIP_PREFIXES = ['vscode_git_', 'git_config_key_', 'git_config_value_', 'git_trace'];

export function gitEnv(env: NodeJS.ProcessEnv): Record<string, string> {
	const out: Record<string, string> = {};
	let all: string | undefined;
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) continue;
		const lower = key.toLowerCase();
		if (STRIP.has(lower) || STRIP_PREFIXES.some((p) => lower.startsWith(p))) continue;
		// LC_ALL would override LC_MESSAGES; keep its character set as LC_CTYPE so non-ASCII
		// paths are still encoded the same way.
		if (lower === 'lc_all') {
			all = value;
			continue;
		}
		out[key] = value;
	}
	if (all !== undefined && out['LC_CTYPE'] === undefined) out['LC_CTYPE'] = all;
	// GIT_TERMINAL_PROMPT=0: never hang on a username/password prompt in a terminal nobody can
	// see. Git Credential Manager still opens its own sign-in window when it needs one.
	return { ...out, LC_MESSAGES: 'C', GIT_TERMINAL_PROMPT: '0' };
}
