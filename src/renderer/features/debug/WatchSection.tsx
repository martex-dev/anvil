import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { type JSX, useState } from 'react';

import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { useDebugStore } from './debug-store';
import { DebugSection, SectionNote } from './DebugSection';
import { evaluate } from './evaluate';
import { useDebugKey, VariableRow } from './VariableTree';
import { useWatches } from './watch-store';

function WatchRow({ expression, index }: { expression: string; index: number }): JSX.Element {
	const paused = useDebugStore((s) => s.status === 'paused');
	const frameId = useDebugStore((s) => s.frameId);
	const key = useDebugKey('watch', frameId, expression);
	const value = useQuery({
		queryKey: key,
		queryFn: () => evaluate(expression, 'watch'),
		enabled: paused && frameId !== null,
		staleTime: Infinity,
		retry: false,
	});
	const remove = (
		<IconButton
			size='sm'
			label={`Remove watch ${expression}`}
			icon={<X size={12} />}
			className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
			onClick={(e) => {
				e.stopPropagation();
				useWatches.getState().remove(index);
			}}
		/>
	);
	let shown = 'not available';
	if (paused && value.isPending) shown = '…';
	else if (value.isError) shown = value.error.message;
	else if (value.data) shown = value.data.result;
	return (
		<VariableRow
			name={expression}
			value={shown}
			type={value.data?.type}
			reference={value.data?.variablesReference ?? 0}
			depth={0}
			error={value.isError}
			actions={remove}
		/>
	);
}

/** Expressions re-evaluated in the selected frame at every stop. */
export function WatchSection(): JSX.Element {
	const expressions = useWatches((s) => s.expressions);
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState('');
	const commit = (): void => {
		useWatches.getState().add(draft);
		setDraft('');
		setAdding(false);
	};
	return (
		<DebugSection
			title='Watch'
			actions={
				<IconButton
					size='sm'
					label='Add watch expression'
					icon={<Plus size={13} />}
					onClick={() => setAdding(true)}
				/>
			}
		>
			{expressions.length === 0 && !adding && (
				<SectionNote>Add an expression to follow its value.</SectionNote>
			)}
			<div role='tree' aria-label='Watch'>
				{expressions.map((e, i) => (
					<WatchRow key={e} expression={e} index={i} />
				))}
			</div>
			{adding && (
				<div className='px-2 pt-1'>
					<Input
						autoFocus
						aria-label='Watch expression'
						placeholder='Expression, e.g. df.shape'
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === 'Enter') commit();
							if (e.key === 'Escape') {
								setDraft('');
								setAdding(false);
							}
						}}
						className='font-mono'
					/>
				</div>
			)}
		</DebugSection>
	);
}
