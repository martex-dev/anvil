import { TriangleAlert } from 'lucide-react';
import type { CSSProperties, JSX } from 'react';

import { cn } from '../../lib/cn';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { SnapImage } from './use-snap-render';

interface SnapPreviewProps {
	image: SnapImage | null;
	loading: boolean;
	error: string | null;
	/** Monaco isn't loaded, so there's nothing to colorize with. */
	unavailable: boolean;
	transparent: boolean;
	onRetry: () => void;
}

const dotGrid: CSSProperties = {
	backgroundImage: 'radial-gradient(var(--border-strong) 1px, transparent 1px)',
	backgroundSize: '18px 18px',
};

const checkerboard: CSSProperties = {
	background: 'repeating-conic-gradient(var(--bg-2) 0% 25%, var(--bg-1) 0% 50%) 50% / 16px 16px',
};

export function SnapPreview({
	image,
	loading,
	error,
	unavailable,
	transparent,
	onRetry,
}: SnapPreviewProps): JSX.Element {
	let body: JSX.Element;
	if (unavailable) {
		body = (
			<ErrorState
				title='Nothing to colorize yet'
				message='Open a file in the editor first: Code Snap uses the editor’s syntax highlighter and theme.'
			/>
		);
	} else if (image) {
		body = (
			<img
				src={image.url}
				alt='Code snap preview'
				draggable={false}
				// Box capped at the 1× size and the stage; object-contain keeps the aspect ratio.
				style={{ width: image.width, height: image.height }}
				className={cn(
					'max-h-full max-w-full object-contain transition-opacity transition-base',
					loading && 'opacity-60',
				)}
			/>
		);
	} else if (error) {
		body = <ErrorState title='Could not render the snap' message={error} onRetry={onRetry} />;
	} else {
		body = (
			<div className='flex flex-col items-center gap-3'>
				<Spinner size={24} label='Rendering snap' />
				<span className='hud'>Colorizing</span>
				<div className='shimmer h-1 w-40 rounded-full bg-bg-2' />
			</div>
		);
	}

	return (
		<div
			className='relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-bg-0/60 p-8'
			style={transparent && image ? checkerboard : dotGrid}
			aria-busy={loading || undefined}
		>
			{body}
			{image && loading && (
				<span className='glass-strong animate-fade absolute top-3 right-3 flex items-center gap-2 rounded-md px-2 py-1'>
					<Spinner size={12} label='Updating preview' />
					<span className='hud'>Rendering</span>
				</span>
			)}
			{image && error && !loading && (
				<span
					role='alert'
					className='animate-fade absolute bottom-3 left-1/2 flex max-w-[80%] -translate-x-1/2 items-center gap-2 rounded-md border border-down/40 bg-down-soft px-2 py-1 text-12 text-down'
				>
					<TriangleAlert size={13} className='shrink-0' aria-hidden />
					<span className='truncate'>{error}</span>
					<button
						type='button'
						onClick={onRetry}
						className='shrink-0 rounded-sm px-1 font-medium underline-offset-2 hover:underline focus-visible:shadow-glow focus-visible:outline-none'
					>
						Retry
					</button>
				</span>
			)}
		</div>
	);
}
