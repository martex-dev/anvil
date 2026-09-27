import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Braces, SearchX, SquareTerminal } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import type { ReplVariable } from '@shared/ipc/channels/python';

import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Input } from '../../ui/Input';
import { openRepl, sendToRepl } from './run';
import { filterVariables, inspectExpression } from './variables';

const VARS_KEY = ['python', 'vars'] as const;

/** Live: the REPL rewrites its summary after every run, and main pushes it here. */
function useReplVariables(): ReturnType<typeof useQuery<ReplVariable[]>> {
	const client = useQueryClient();
	useAnvilEvent('python:vars', (vars) => client.setQueryData(VARS_KEY, vars));
	return useQuery({ queryKey: VARS_KEY, queryFn: () => call('python:vars') });
}

const inspect = (v: ReplVariable): void => {
	sendToRepl(inspectExpression(v)).catch((error: unknown) =>
		toast.error('Could not reach the REPL', error instanceof Error ? error.message : undefined),
	);
};

/**
 * The Python REPL's variables (Spyder / PyCharm style): name, type, shape and value after every
 * cell you run. Clicking one prints it in the REPL (a table's first rows).
 */
export function VariablesView(): JSX.Element {
	const query = useReplVariables();
	const [filter, setFilter] = useState('');
	const vars = useMemo(() => filterVariables(query.data ?? [], filter), [query.data, filter]);

	if (query.isError)
		return (
			<ErrorState
				title="Couldn't read the REPL's variables"
				message={query.error instanceof Error ? query.error.message : String(query.error)}
				onRetry={() => void query.refetch()}
			/>
		);
	if ((query.data ?? []).length === 0)
		return (
			<EmptyState
				icon={<Braces size={22} />}
				title='No variables yet'
				description='Run a # %% cell (Ctrl+Enter) or a line in the Python REPL; its variables show up here.'
				action={
					<Button size='sm' icon={<SquareTerminal size={12} />} onClick={openRepl}>
						Open REPL
					</Button>
				}
			/>
		);
	return (
		<div data-part='variables' className='flex h-full min-h-0 flex-col'>
			<div className='flex shrink-0 items-center gap-2 px-2 py-1.5'>
				<Input
					aria-label='Filter variables'
					placeholder='Filter by name, type or value'
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					className='h-7 max-w-72 text-12'
				/>
				<span className='num text-11 text-fg-2'>
					{vars.length === (query.data ?? []).length
						? `${vars.length} variables`
						: `${vars.length} of ${(query.data ?? []).length}`}
				</span>
			</div>
			{vars.length === 0 ? (
				<EmptyState icon={<SearchX size={20} />} title='No variables match the filter' />
			) : (
				<div className='min-h-0 flex-1 overflow-auto'>
					<table className='w-full table-fixed border-collapse text-12'>
						<thead className='sticky top-0 bg-bg-1 text-left text-11 text-fg-2'>
							<tr>
								<th className='w-40 px-2 py-1 font-medium'>Name</th>
								<th className='w-44 px-2 py-1 font-medium'>Type</th>
								<th className='w-28 px-2 py-1 font-medium'>Size</th>
								<th className='px-2 py-1 font-medium'>Value</th>
							</tr>
						</thead>
						<tbody>
							{vars.map((v) => (
								<tr
									key={v.name}
									tabIndex={0}
									title={`Print ${v.name} in the REPL`}
									onClick={() => inspect(v)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') inspect(v);
									}}
									className='cursor-pointer border-t border-glass-edge outline-none hover:bg-bg-3/60 focus-visible:bg-accent-soft'
								>
									<td className='truncate px-2 py-1 font-mono text-fg-0'>
										{v.name}
									</td>
									<td className='truncate px-2 py-1 text-[var(--syn-type)]'>
										{v.type}
									</td>
									<td className='num truncate px-2 py-1 text-fg-1'>{v.size}</td>
									<td
										className='truncate px-2 py-1 font-mono text-fg-1'
										title={v.value}
									>
										{v.value}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
