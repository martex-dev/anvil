import { useEffect, useRef, useState } from 'react';

import { rlog } from '../../lib/log';
import { canvasToPng, renderSnap, type RenderSnapOptions } from './render';

export interface SnapImage {
	blob: Blob;
	url: string;
	/** Size at 1×, for sizing the preview. */
	width: number;
	height: number;
	/** Pixel size of the exported PNG. */
	pixelWidth: number;
	pixelHeight: number;
}

interface Result {
	input: RenderSnapOptions;
	image: SnapImage | null;
	error: string | null;
}

export interface SnapRenderState {
	/** The latest finished image; kept on screen (dimmed) while a newer one renders. */
	image: SnapImage | null;
	error: string | null;
	loading: boolean;
}

/**
 * Renders `input` to a PNG whenever it changes (pass a memoized object). Loading is derived by
 * comparing the last result's input with the current one, so no state is set during the effect.
 */
export function useSnapRender(input: RenderSnapOptions | null): SnapRenderState {
	const [result, setResult] = useState<Result | null>(null);
	const urlRef = useRef<string | null>(null);

	useEffect(() => {
		if (!input) return;
		let cancelled = false;
		renderSnap(input)
			.then(async (canvas) => {
				const blob = await canvasToPng(canvas);
				if (cancelled) return;
				const url = URL.createObjectURL(blob);
				if (urlRef.current) URL.revokeObjectURL(urlRef.current);
				urlRef.current = url;
				setResult({
					input,
					error: null,
					image: {
						blob,
						url,
						width: Number.parseFloat(canvas.style.width) || canvas.width,
						height: Number.parseFloat(canvas.style.height) || canvas.height,
						pixelWidth: canvas.width,
						pixelHeight: canvas.height,
					},
				});
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				rlog.warn('snap', 'Render failed', error);
				setResult((prev) => ({
					input,
					image: prev?.image ?? null,
					error: error instanceof Error ? error.message : String(error),
				}));
			});
		return () => {
			cancelled = true;
		};
	}, [input]);

	useEffect(
		() => () => {
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		},
		[],
	);

	return {
		image: result?.image ?? null,
		error: result?.input === input ? (result?.error ?? null) : null,
		loading: input !== null && result?.input !== input,
	};
}
