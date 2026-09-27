import { useEffect } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { useChat } from './chat-store';
import { isOneShot, routeDelta, routeDone, routeError } from './requests';

/**
 * Headless: routes streamed replies to whoever asked (the chat, an inline edit, the commit box),
 * even while the AI panel is closed, so nothing is lost mid-answer. Also shows the open
 * folder's own conversation.
 */
export function AiStreamController(): null {
	const { info, isLoading } = useWorkspace();
	// Syncs the chat store (outside React) with the open folder once it is known.
	useEffect(() => {
		if (!isLoading) useChat.getState().openWorkspace(info.root);
	}, [info.root, isLoading]);

	useAnvilEvent('ai:delta', ({ requestId, text }) =>
		isOneShot(requestId)
			? routeDelta(requestId, text)
			: useChat.getState().onDelta(requestId, text),
	);
	useAnvilEvent('ai:done', ({ requestId, inputTokens, outputTokens, cancelled, truncated }) =>
		isOneShot(requestId)
			? routeDone(requestId, cancelled, truncated)
			: useChat
					.getState()
					.onDone(requestId, { inputTokens, outputTokens }, cancelled, truncated),
	);
	useAnvilEvent('ai:error', ({ requestId, message }) =>
		isOneShot(requestId)
			? routeError(requestId, message)
			: useChat.getState().onError(requestId, message),
	);
	return null;
}
