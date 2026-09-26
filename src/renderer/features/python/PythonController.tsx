import { useQueryClient } from '@tanstack/react-query';

import { useAnvilEvent } from '../../lib/use-anvil-event';
import { applyPythonChanged } from './use-python';

/**
 * Headless (mounted once by the shell): the single python:changed subscriber, so one interpreter
 * change means one round of refetches however many chips and views show the interpreter.
 */
export function PythonController(): null {
	const client = useQueryClient();
	useAnvilEvent('python:changed', (change) => applyPythonChanged(client, change));
	return null;
}
