import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { PythonEnv } from '@shared/ipc/channels/python';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { PRESETS_KEY } from '../terminal/TerminalPane';

export const pythonKeys = {
	selected: (root: string | null) => ['python', root, 'selected'] as const,
	envs: (root: string | null) => ['python', root, 'envs'] as const,
	packages: (root: string | null, env: string | null) =>
		['python', root, 'packages', env] as const,
	tools: (root: string | null, env: string | null) => ['python', root, 'tools', env] as const,
};

/** The interpreter in use for the open folder; follows picks made anywhere. */
export function useSelectedPython(): {
	env: PythonEnv | null;
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
} {
	const { info } = useWorkspace();
	const client = useQueryClient();
	const q = useQuery({
		queryKey: pythonKeys.selected(info.root),
		queryFn: () => call('python:selected'),
		staleTime: Infinity,
	});
	useAnvilEvent('python:changed', (env) => {
		client.setQueryData(pythonKeys.selected(info.root), env);
		void client.invalidateQueries({ queryKey: ['python', info.root] });
		// The REPL and env-shell presets are only available while an interpreter resolves.
		void client.invalidateQueries({ queryKey: PRESETS_KEY });
	});
	return {
		env: q.data ?? null,
		isLoading: q.isLoading,
		error: q.error,
		refetch: () => void q.refetch(),
	};
}

/** Rediscovers the interpreters (a venv made outside Anvil, a new install) and re-resolves. */
export async function rescanPythonEnvs(root: string | null): Promise<void> {
	await call('python:envs', { refresh: true });
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: pythonKeys.selected(root) }),
		queryClient.invalidateQueries({ queryKey: pythonKeys.envs(root) }),
	]);
}

const KIND_LABEL: Record<PythonEnv['kind'], string> = {
	venv: 'venv',
	uv: 'uv',
	conda: 'conda',
	system: 'system',
};

/** Palette-style picker over every interpreter Anvil can find. */
export async function pickPythonEnv(): Promise<void> {
	const root = queryClient.getQueryData<{ root: string | null }>(['workspace'])?.root ?? null;
	if (!root) {
		toast.info('Open a folder first', 'The interpreter is chosen per project.');
		return;
	}
	const current = queryClient.getQueryData<PythonEnv | null>(pythonKeys.selected(root));
	const picked = await quickPick({
		title: 'python',
		placeholder: 'Select the interpreter for this folder',
		items: call('python:envs', { refresh: true }).then((envs) => [
			...envs.map((e) => ({
				id: e.path,
				label: `${e.label}${e.version ? `  ·  Python ${e.version}` : ''}`,
				description: `${KIND_LABEL[e.kind]}${e.local ? ' · this folder' : ''}`,
				detail: e.path,
				current: current?.path.toLowerCase() === e.path.toLowerCase(),
			})),
			{
				id: '__auto__',
				label: 'Automatic',
				description: "the folder's .venv if there is one",
				detail: 'Anvil picks',
			},
		]),
	});
	if (!picked) return;
	try {
		await call('python:select', picked === '__auto__' ? null : picked);
		toast.success('Interpreter selected', picked === '__auto__' ? 'Automatic' : picked);
	} catch (error) {
		toast.error(
			'Could not select interpreter',
			error instanceof Error ? error.message : undefined,
		);
	}
}
