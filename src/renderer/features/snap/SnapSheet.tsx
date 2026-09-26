import { Aperture, Copy, Download, X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { type JSX, type KeyboardEvent, useCallback, useMemo, useState } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/Kbd';
import { backgroundById } from './backgrounds';
import type { RenderSnapOptions } from './render';
import { snapFileName } from './snap-layout';
import { loadSnapOptions, saveSnapOptions, type SnapOptions } from './snap-options';
import { type SnapRequest, useSnap } from './snap-store';
import { SnapOptionsPanel } from './SnapOptionsPanel';
import { SnapPreview } from './SnapPreview';
import { useSnapRender } from './use-snap-render';

interface SnapSheetProps {
	request: SnapRequest;
}

export function SnapSheet({ request }: SnapSheetProps): JSX.Element {
	useRegisterOverlay(true);
	const closeSnap = useSnap((s) => s.closeSnap);
	const { settings } = useSettings();
	const [options, setOptions] = useState<SnapOptions>(loadSnapOptions);

	const monacoReady = getLoadedMonaco() !== null;
	const fontSize = options.fontSize ?? settings.editorFontSize;
	const startLine = request.startLine ?? 1;
	const lineCount = request.code.split('\n').length;

	const input = useMemo<RenderSnapOptions | null>(
		() =>
			monacoReady
				? {
						code: request.code,
						language: request.language,
						title: request.title,
						startLine,
						fontSize,
						tabSize: settings.tabSize,
						background: options.background,
						padding: options.padding,
						chrome: options.chrome,
						lineNumbers: options.lineNumbers,
						shadow: options.shadow,
						glow: options.glow,
						watermark: options.watermark,
					}
				: null,
		[monacoReady, request, startLine, fontSize, settings.tabSize, options],
	);
	const { image, error, loading } = useSnapRender(input);

	const update = (patch: Partial<SnapOptions>): void => {
		const next = { ...options, ...patch };
		setOptions(next);
		saveSnapOptions(next);
	};

	const copy = useCallback(async (): Promise<void> => {
		if (!image) return;
		try {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })]);
			toast.success('Snap copied');
		} catch (err) {
			toast.error(
				'Could not copy the snap',
				err instanceof Error ? err.message : String(err),
			);
		}
	}, [image]);

	const save = (): void => {
		if (!image) return;
		const url = URL.createObjectURL(image.blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = snapFileName(request.title);
		link.click();
		// The download grabs the blob asynchronously; give it a moment before revoking.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		const isCopy =
			(event.ctrlKey || event.metaKey) &&
			!event.shiftKey &&
			!event.altKey &&
			event.key.toLowerCase() === 'c';
		if (!isCopy || window.getSelection()?.toString()) return;
		event.preventDefault();
		void copy();
	};

	return (
		<RadixDialog.Root open onOpenChange={(open) => !open && closeSnap()}>
			<RadixDialog.Portal>
				<RadixDialog.Overlay className='animate-fade fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]' />
				<RadixDialog.Content
					onKeyDown={onKeyDown}
					onOpenAutoFocus={(event) => {
						// Focus the sheet itself: the first control is the close button, and a
						// focused tooltip trigger would pop its tooltip on open.
						event.preventDefault();
						if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
					}}
					className='glass-strong animate-in fixed top-1/2 left-1/2 z-50 flex h-[min(760px,calc(100vh-3rem))] w-[min(1180px,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl outline-none'
				>
					<header className='flex items-center gap-3 border-b border-glass-edge px-4 py-2.5'>
						<span className='flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent'>
							<Aperture size={15} />
						</span>
						<div className='min-w-0 flex-1'>
							<RadixDialog.Title className='text-14 font-semibold text-fg-0'>
								Code <span className='text-gradient'>Snap</span>
							</RadixDialog.Title>
							<RadixDialog.Description className='hud truncate'>
								{request.title} · {lineCount} {lineCount === 1 ? 'line' : 'lines'} ·{' '}
								{request.language}
							</RadixDialog.Description>
						</div>
						<RadixDialog.Close
							aria-label='Close'
							className='rounded-sm p-1 text-fg-2 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
						>
							<X size={14} />
						</RadixDialog.Close>
					</header>

					<div className='flex min-h-0 flex-1'>
						<SnapPreview
							image={image}
							loading={loading}
							error={error}
							unavailable={!monacoReady}
							transparent={backgroundById(options.background).paint === null}
							// A new options object is a new render input, which re-runs the render.
							onRetry={() => setOptions({ ...options })}
						/>
						<SnapOptionsPanel
							options={options}
							fontSize={fontSize}
							startLine={startLine}
							onChange={update}
						/>
					</div>

					<footer className='flex items-center gap-3 border-t border-glass-edge px-4 py-2.5'>
						<span className='hud num'>
							{image
								? `${image.pixelWidth} × ${image.pixelHeight} · PNG`
								: 'Rendering…'}
						</span>
						<span className='flex-1' />
						<span className='flex items-center gap-1.5 text-11 text-fg-2'>
							<Kbd keys='Ctrl+C' /> copy
							<Kbd keys='Esc' className='ml-2' /> close
						</span>
						<Button icon={<Download size={13} />} onClick={save} disabled={!image}>
							Save PNG
						</Button>
						<Button
							variant='primary'
							icon={<Copy size={13} />}
							onClick={() => void copy()}
							disabled={!image}
						>
							Copy image
						</Button>
					</footer>
				</RadixDialog.Content>
			</RadixDialog.Portal>
		</RadixDialog.Root>
	);
}
