import { useQuery } from '@tanstack/react-query';
import { Boxes, FlaskConical } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { Input } from '../../ui/Input';
import { RefreshButton } from './RefreshButton';
import { RunSection } from './RunSection';
import { pythonKeys, useSelectedPython } from './use-python';

/** Libraries worth seeing at a glance in quant / ML / crypto work. */
const STACK = [
	'numpy',
	'pandas',
	'polars',
	'pyarrow',
	'duckdb',
	'scipy',
	'scikit-learn',
	'statsmodels',
	'torch',
	'lightgbm',
	'xgboost',
	'optuna',
	'matplotlib',
	'plotly',
	'ccxt',
	'web3',
	'solana',
	'httpx',
	'fastapi',
	'ipython',
	'pytest',
	'ruff',
];

/** The selected interpreter's installed packages, with the quant stack pinned on top. */
export function PackagesSection(): JSX.Element {
	const { info } = useWorkspace();
	const { env } = useSelectedPython();
	const packages = useQuery({
		queryKey: pythonKeys.packages(info.root, env?.path ?? null),
		queryFn: () => call('python:packages'),
		enabled: Boolean(env),
		staleTime: 60_000,
	});
	const [filter, setFilter] = useState('');
	const stack = useMemo(() => {
		const byName = new Map((packages.data ?? []).map((p) => [p.name.toLowerCase(), p.version]));
		return STACK.filter((n) => byName.has(n)).map((n) => ({
			name: n,
			version: byName.get(n) ?? '',
		}));
	}, [packages.data]);
	const shown = useMemo(
		() =>
			(packages.data ?? []).filter((p) =>
				p.name.toLowerCase().includes(filter.trim().toLowerCase()),
			),
		[packages.data, filter],
	);
	return (
		<RunSection
			title={`Packages${packages.data ? ` · ${packages.data.length}` : ''}`}
			action={
				<RefreshButton
					label='Refresh packages'
					busy={packages.isFetching}
					onClick={() => void packages.refetch()}
				/>
			}
		>
			{!env ? (
				<p className='text-12 text-fg-2'>Select an interpreter to list its packages.</p>
			) : packages.isLoading ? (
				<div className='shimmer h-16 rounded-md' />
			) : packages.error ? (
				<p className='text-12 text-down'>{packages.error.message}</p>
			) : (
				<>
					{stack.length > 0 && (
						<div className='mb-2 flex flex-wrap gap-1'>
							{stack.map((p) => (
								<span
									key={p.name}
									className='flex items-center gap-1 rounded-md border border-glass-edge bg-bg-2/40 px-1.5 py-0.5 text-11'
								>
									<Boxes size={10} className='text-accent' />
									{p.name}
									<span className='num text-fg-2'>{p.version}</span>
								</span>
							))}
						</div>
					)}
					<Input
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder='Filter packages'
						className='mb-1 h-6 text-12'
						leading={<FlaskConical size={11} />}
					/>
					{shown.length === 0 ? (
						<p className='px-1 py-1 text-12 text-fg-2'>
							{filter.trim()
								? `No packages match “${filter.trim()}”.`
								: 'No packages installed in this environment.'}
						</p>
					) : (
						<ul className='max-h-72 overflow-auto'>
							{shown.map((p) => (
								<li
									key={p.name}
									className='flex h-6 items-center gap-2 px-1 text-12'
								>
									<span className='truncate text-fg-1'>{p.name}</span>
									<span className='num ml-auto text-11 text-fg-2'>
										{p.version}
									</span>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</RunSection>
	);
}
