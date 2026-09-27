import { useQueryClient } from '@tanstack/react-query';

import type { PythonEnv } from '@shared/ipc/channels/python';

import { WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { offerReplRestart } from './repl-notice';
import { applyPythonChanged, pythonKeys } from './use-python';

/**
 * Headless (mounted once by the shell): the single python:changed subscriber, so one interpreter
 * change means one round of refetches however many chips and views show the interpreter.
 */
export function PythonController(): null {
	const client = useQueryClient();
	useAnvilEvent('python:changed', (change) => {
		// Read before applying: undefined means this folder's interpreter wasn't known yet.
		const before = client.getQueryData<PythonEnv | null>(pythonKeys.selected(change.root));
		applyPythonChanged(client, change);
		const root = client.getQueryData<{ root: string | null }>(WORKSPACE_KEY)?.root ?? null;
		if (change.root === root) offerReplRestart(before, change.env);
	});
	return null;
}
