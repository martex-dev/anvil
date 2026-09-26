import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** How close to the end (px) still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 40;

export function isNearBottom(el: {
	scrollHeight: number;
	scrollTop: number;
	clientHeight: number;
}): boolean {
	return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
}

export interface StickToBottom {
	ref: RefObject<HTMLDivElement | null>;
	onScroll: () => void;
	/** The user scrolled up: new content arrives without moving the view. */
	away: boolean;
	/** Scrolls to the end and follows new content again. */
	jump: () => void;
}

/**
 * Follows new content (streamed tokens) only while the list is scrolled to the end, so you can
 * scroll up and read an earlier message while a reply is still streaming.
 */
export function useStickToBottom(content: unknown): StickToBottom {
	const ref = useRef<HTMLDivElement>(null);
	const stick = useRef(true);
	const [away, setAway] = useState(false);

	const onScroll = useCallback((): void => {
		const el = ref.current;
		if (!el) return;
		stick.current = isNearBottom(el);
		setAway(!stick.current);
	}, []);

	const jump = useCallback((): void => {
		const el = ref.current;
		stick.current = true;
		setAway(false);
		if (el) el.scrollTop = el.scrollHeight;
	}, []);

	useEffect(() => {
		const el = ref.current;
		if (el && stick.current) el.scrollTop = el.scrollHeight;
	}, [content]);

	return { ref, onScroll, away, jump };
}
