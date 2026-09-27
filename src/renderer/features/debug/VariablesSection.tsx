import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { Spinner } from '../../ui/Spinner';
import { useDebugStore } from './debug-store';
import { DebugSection, SectionNote } from './DebugSection';
import { frameScopes } from './evaluate';
import { useDebugKey, VariableChildren, VariableRow } from './VariableTree';

/** Locals and globals of the selected frame; Locals open, the rest one click away. */
export function VariablesSection(): JSX.Element {
	const paused = useDebugStore((s) => s.status === 'paused');
	const frameId = useDebugStore((s) => s.frameId);
	const key = useDebugKey('scopes', frameId);
	const scopes = useQuery({
		queryKey: key,
		queryFn: () => (frameId === null ? Promise.resolve([]) : frameScopes(frameId)),
		enabled: paused && frameId !== null,
		staleTime: Infinity,
	});
	let body: JSX.Element;
	if (!paused || frameId === null)
		body = <SectionNote>Variables show while the program is paused.</SectionNote>;
	else if (scopes.isPending)
		body = (
			<div className='flex h-7 items-center px-3'>
				<Spinner size={12} label='Loading variables' />
			</div>
		);
	else if (scopes.isError)
		body = (
			<p role='alert' className='px-3 py-1 text-12 text-down'>
				Could not read variables: {scopes.error.message}
			</p>
		);
	else
		body = (
			<div role='tree' aria-label='Variables'>
				{scopes.data.map((scope, i) =>
					// The first scope (Locals) is what you look at nearly every time.
					i === 0 ? (
						<VariableChildren
							key={scope.name}
							reference={scope.variablesReference}
							depth={0}
						/>
					) : (
						<VariableRow
							key={scope.name}
							name={scope.name}
							value=''
							reference={scope.variablesReference}
							depth={0}
						/>
					),
				)}
			</div>
		);
	return <DebugSection title='Variables'>{body}</DebugSection>;
}
