import { toast } from '../../stores/toast-store';
import { runInTerminal } from '../terminal/terminal-store';

export interface DebugpyInstall {
	/** Short name of the environment (".venv", "conda: base"). */
	env: string;
	/** The pip / uv pip line main built for that interpreter. */
	command: string;
}

/** Runs the install in a terminal, where the user sees pip (or uv) work and can answer it. */
export function installDebugpy(install: DebugpyInstall): void {
	void runInTerminal({
		role: 'task:install-debugpy',
		preset: 'powershell',
		title: 'install debugpy',
		command: install.command,
	});
}

/**
 * debugpy isn't in the selected environment. Anvil ships no Python (ADR-004), so it offers to
 * install debugpy there rather than bundling one. The Debug view shows the same offer.
 */
export function offerDebugpyInstall(install: DebugpyInstall): void {
	toast.info(
		`debugpy is not installed in ${install.env}`,
		'The debugger needs it in the selected Python environment. Start debugging again once it is installed.',
		{ label: 'Install debugpy', run: () => installDebugpy(install) },
	);
}
