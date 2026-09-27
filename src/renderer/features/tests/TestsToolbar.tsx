import { ListRestart, Play, RefreshCw, ScrollText, Search, Square } from 'lucide-react';
import { forwardRef, type JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import type { TestCounts } from './results';
import {
	cancelTests,
	discoverTests,
	runFailedTests,
	runTests,
	showTestOutput,
} from './tests-store';

interface TestsToolbarProps {
	counts: TestCounts;
	running: boolean;
	discovering: boolean;
	filter: string;
	onFilter: (text: string) => void;
}

function Count({
	kind,
	value,
	className,
}: {
	kind: string;
	value: number;
	className: string;
}): JSX.Element {
	return (
		<span
			data-part='test-count'
			data-count={kind}
			title={`${value} ${kind}`}
			className={cn('num flex items-center gap-0.5', value > 0 ? className : 'text-fg-2')}
		>
			{value} <span className='text-fg-2'>{kind}</span>
		</span>
	);
}

/** Run controls, pass/fail counts and the filter box above the test tree. */
export const TestsToolbar = forwardRef<HTMLInputElement, TestsToolbarProps>(function TestsToolbar(
	{ counts, running, discovering, filter, onFilter },
	filterRef,
) {
	return (
		<div data-part='tests-toolbar' className='flex shrink-0 flex-col gap-1.5 px-2 pt-2 pb-1.5'>
			<div className='flex items-center gap-0.5'>
				<IconButton
					size='sm'
					label='Run All Tests'
					shortcut={shortcutFor('tests.runAll')}
					icon={<Play size={13} />}
					onClick={() => void runTests()}
				/>
				<IconButton
					size='sm'
					label='Run Failed Tests'
					icon={<ListRestart size={13} />}
					disabled={counts.failed === 0}
					onClick={() => void runFailedTests()}
				/>
				{running && (
					<IconButton
						size='sm'
						label='Stop Test Run'
						icon={<Square size={11} />}
						onClick={() => void cancelTests()}
					/>
				)}
				<IconButton
					size='sm'
					label='Refresh Tests'
					icon={discovering ? <Spinner size={12} /> : <RefreshCw size={12} />}
					disabled={discovering}
					onClick={() => void discoverTests()}
				/>
				<IconButton
					size='sm'
					label='Show Test Output'
					icon={<ScrollText size={12} />}
					onClick={() => void showTestOutput()}
				/>
				<span className='flex-1' />
				<span
					data-part='test-counts'
					aria-live='polite'
					className='flex items-center gap-2 text-10'
				>
					<Count kind='passed' value={counts.passed} className='text-up' />
					<Count kind='failed' value={counts.failed} className='text-down' />
					<Count kind='skipped' value={counts.skipped} className='text-warn' />
				</span>
			</div>
			<Input
				ref={filterRef}
				value={filter}
				onChange={(e) => onFilter(e.target.value)}
				leading={<Search size={12} />}
				placeholder={`Filter ${counts.total} tests`}
				aria-label='Filter tests'
				className='h-6 text-12'
			/>
		</div>
	);
});
