import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { activatedEnv } from '../python/interpreter';

export type LspLanguage = 'python' | 'typescript';

export interface ServerLaunch {
	/** Script run with Electron's own Node (ELECTRON_RUN_AS_NODE), so no system Node is needed. */
	script: string;
	args: string[];
	env: NodeJS.ProcessEnv;
	/** Monaco language ids this server handles. */
	languageIds: string[];
	initializationOptions: Record<string, unknown>;
}

/** Language servers are asar-unpacked when packaged: they read many files and spawn workers. */
function packageFile(pkg: string, file: string): string {
	const path = join(dirname(require.resolve(`${pkg}/package.json`)), file);
	return path.replace(/\.asar([\\/])/, '.asar.unpacked$1');
}

/** The project's own tsserver, if it has one. Running it runs code from the folder. */
export function workspaceTsserver(root: string): string | null {
	const local = join(root, 'node_modules', 'typescript', 'lib', 'tsserver.js');
	return existsSync(local) ? local : null;
}

/**
 * The TypeScript Anvil ships, unless the user chose the project's own version (its plugins and
 * exact version) for this folder. Never automatic: opening a downloaded repository must not run
 * its node_modules.
 */
export function tsserverPath(root: string, useWorkspace = false): string {
	const local = useWorkspace ? workspaceTsserver(root) : null;
	return local ?? packageFile('typescript', 'lib/tsserver.js');
}

export function serverLaunch(
	language: LspLanguage,
	root: string,
	python: string | null = null,
	baseEnv = process.env,
	useWorkspaceTs = false,
): ServerLaunch {
	if (language === 'python') {
		// basedpyright finds site-packages by asking `python`; put the chosen interpreter first.
		const env: NodeJS.ProcessEnv = {
			...(python ? activatedEnv(python, baseEnv) : baseEnv),
			ELECTRON_RUN_AS_NODE: '1',
		};
		return {
			script: packageFile('basedpyright', 'langserver.index.js'),
			args: ['--stdio'],
			env,
			languageIds: ['python'],
			initializationOptions: {},
		};
	}
	return {
		script: packageFile('typescript-language-server', 'lib/cli.mjs'),
		args: ['--stdio'],
		env: { ...baseEnv, ELECTRON_RUN_AS_NODE: '1' },
		languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
		initializationOptions: { tsserver: { path: tsserverPath(root, useWorkspaceTs) } },
	};
}
