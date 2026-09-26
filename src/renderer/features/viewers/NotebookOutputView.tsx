import { CodeXml } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import type { NotebookOutput } from './notebook-model';

const TEXT = 'selectable max-h-96 overflow-auto font-mono text-12 leading-5 whitespace-pre-wrap';

/** One cell output. Rich HTML is never injected: this app has privileged IPC in the window. */
export function NotebookOutputView({ output }: { output: NotebookOutput }): JSX.Element {
	switch (output.kind) {
		case 'stream':
			return (
				<pre
					className={cn(
						TEXT,
						'px-3 py-1.5',
						output.name === 'stderr'
							? 'rounded-sm bg-down-soft text-down'
							: 'text-fg-1',
					)}
				>
					{output.text}
				</pre>
			);
		case 'text':
			return <pre className={cn(TEXT, 'px-3 py-1.5 text-fg-0')}>{output.text}</pre>;
		case 'image':
			return (
				<div className='px-3 py-2'>
					<img
						src={output.src}
						alt={`Output (${output.mime})`}
						draggable={false}
						className='max-w-full rounded-sm'
					/>
				</div>
			);
		case 'error':
			return (
				<div className='rounded-sm border border-down/30 bg-down-soft px-3 py-2'>
					<p className='selectable font-mono text-12 font-medium text-down'>
						{output.ename}
						{output.evalue && <span className='text-fg-0'>: {output.evalue}</span>}
					</p>
					{output.traceback && (
						<pre className={cn(TEXT, 'mt-1.5 text-11 text-fg-1')}>
							{output.traceback}
						</pre>
					)}
				</div>
			);
		case 'unsupported':
			return (
				<p className='flex items-center gap-2 px-3 py-1.5 text-12 text-fg-2'>
					<CodeXml size={14} />
					{output.mimes.join(', ')} output is not rendered here (HTML and widgets are
					unsafe in-app).
				</p>
			);
	}
}
