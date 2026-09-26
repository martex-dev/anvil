import { ChevronDown, ChevronRight } from 'lucide-react';
import type { JSX } from 'react';

import { CodeSource } from './CodeSource';
import { CopySourceButton } from './CopySourceButton';
import { MarkdownHtml } from './MarkdownHtml';
import type { NotebookCell as Cell } from './notebook-model';
import { NotebookOutputView } from './NotebookOutputView';

interface NotebookCellProps {
	cell: Cell;
	/** Notebook path, for resolving relative links in markdown cells. */
	path: string;
	language: string;
	collapsed: boolean;
	onToggleOutputs: () => void;
}

export function NotebookCell({
	cell,
	path,
	language,
	collapsed,
	onToggleOutputs,
}: NotebookCellProps): JSX.Element {
	const count = cell.executionCount === null ? ' ' : String(cell.executionCount);
	const hasOutputs = cell.outputs.length > 0;

	return (
		<section
			className='group grid grid-cols-[72px_minmax(0,1fr)] gap-x-2'
			aria-label={`${cell.kind} cell`}
		>
			<div className='pt-2.5 text-right'>
				{cell.kind === 'code' && <span className='hud num text-fg-2'>In [{count}]:</span>}
			</div>
			<div className='relative min-w-0'>
				<div className='absolute top-1 right-1 z-10'>
					<CopySourceButton text={cell.source} />
				</div>
				{cell.kind === 'code' && (
					<div className='rounded-md border border-glass-edge bg-bg-2/40 transition-[border-color] transition-fast group-focus-within:border-border-strong group-hover:border-border-strong'>
						<CodeSource source={cell.source} language={language} />
					</div>
				)}
				{cell.kind === 'markdown' && (
					<div className='px-3 py-1'>
						<MarkdownHtml text={cell.source} path={path} />
					</div>
				)}
				{cell.kind === 'raw' && (
					<pre className='selectable overflow-x-auto rounded-md border border-dashed border-border px-3 py-2 font-mono text-12 whitespace-pre-wrap text-fg-2'>
						{cell.source}
					</pre>
				)}
			</div>

			{hasOutputs && (
				<>
					<div className='pt-1.5 text-right'>
						<button
							type='button'
							aria-expanded={!collapsed}
							aria-label={collapsed ? 'Expand outputs' : 'Collapse outputs'}
							onClick={onToggleOutputs}
							className='hud num inline-flex items-center gap-0.5 rounded-sm px-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
						>
							{collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
							Out
						</button>
					</div>
					<div className='min-w-0 py-1'>
						{collapsed ? (
							<button
								type='button'
								onClick={onToggleOutputs}
								className='hud rounded-sm px-3 py-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
							>
								{cell.outputs.length} output{cell.outputs.length === 1 ? '' : 's'}{' '}
								hidden
							</button>
						) : (
							<div className='flex flex-col gap-1'>
								{cell.outputs.map((output, i) => (
									<NotebookOutputView key={i} output={output} />
								))}
							</div>
						)}
					</div>
				</>
			)}
		</section>
	);
}
