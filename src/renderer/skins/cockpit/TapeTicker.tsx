import { type JSX, useMemo } from 'react';

import { useProblems } from '../../features/problems/problems-store';
import { useTabsStore } from '../../stores/tabs-store';

interface Quote {
	symbol: string;
	errors: number;
	warnings: number;
}

/**
 * The tape: every open file quoted like a ticker symbol with its error and warning counts,
 * red and falling when it has errors, green and rising when clean. It scrolls when effects are
 * on and sits still otherwise; the numbers are always real.
 */
export function TapeTicker(): JSX.Element {
	const tabs = useTabsStore((s) => s.tabs);
	const items = useProblems((s) => s.items);
	const quotes = useMemo<Quote[]>(() => {
		const paths = [
			...new Set(
				Object.values(tabs)
					.filter((t) => t.kind === 'code' && t.path)
					.map((t) => t.path ?? ''),
			),
		];
		return paths.map((path) => {
			const own = items.filter((p) => p.path === path);
			return {
				symbol: path.split('/').at(-1) ?? path,
				errors: own.filter((p) => p.severity === 'error').length,
				warnings: own.filter((p) => p.severity === 'warning').length,
			};
		});
	}, [tabs, items]);

	const row = (copy: number): JSX.Element => (
		<span className='ck-tape-row' aria-hidden={copy > 0 || undefined}>
			{quotes.length === 0 ? (
				<span className='ck-quote'>
					<span className='ck-quote-sym'>NO OPEN FILES</span>
				</span>
			) : (
				quotes.map((q) => {
					const tone = q.errors ? 'down' : q.warnings ? 'warn' : 'up';
					return (
						<span key={q.symbol} className='ck-quote' data-tone={tone}>
							<span className='ck-quote-sym'>{q.symbol}</span>
							<span className='ck-quote-fig num'>
								{tone === 'up' ? '▲' : '▼'} {q.errors}E {q.warnings}W
							</span>
						</span>
					);
				})
			)}
		</span>
	);

	return (
		<span
			className='ck-tape'
			title='Open files and their problems'
			aria-label={`Open files: ${quotes.map((q) => `${q.symbol} ${q.errors} errors ${q.warnings} warnings`).join(', ')}`}
		>
			<span
				className='ck-tape-track'
				style={{ animationDuration: `${8 + quotes.length * 5}s` }}
			>
				{row(0)}
				{row(1)}
			</span>
		</span>
	);
}
