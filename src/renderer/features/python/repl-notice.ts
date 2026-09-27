import type { PythonEnv } from '@shared/ipc/channels/python';

import { toast } from '../../stores/toast-store';
import { hasRole } from '../terminal/terminal-store';
import { restartRepl } from './run';

/**
 * Whether switching from `before` to `after` leaves an open REPL on the old interpreter. Not on
 * the first report for a folder (`before` undefined: nothing was known yet, e.g. at startup or
 * after a folder switch), nor when the interpreter is the same one.
 */
export function replOutdated(
	before: PythonEnv | null | undefined,
	after: PythonEnv | null,
	replOpen: boolean,
): boolean {
	if (!replOpen || before === undefined) return false;
	return (before?.path.toLowerCase() ?? null) !== (after?.path.toLowerCase() ?? null);
}

/**
 * Tells the user their REPL still runs the previous interpreter and offers a restart now. Main
 * restarts it anyway with the next Run Cell (dropping its variables), so without this the
 * namespace would vanish on a later run with no obvious cause.
 */
export function offerReplRestart(
	before: PythonEnv | null | undefined,
	after: PythonEnv | null,
): void {
	if (!replOutdated(before, after, hasRole('repl'))) return;
	toast.info(
		'The REPL still runs the previous interpreter',
		'It restarts with the new one on your next run, which clears its variables.',
		{ label: 'Restart REPL', run: () => void restartRepl() },
	);
}
