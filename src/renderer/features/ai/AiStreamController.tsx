import { useAnvilEvent } from '../../lib/use-anvil-event';
import { useChat } from './chat-store';
import { isOneShot, routeDelta, routeDone, routeError } from './requests';

/**
 * Headless: routes streamed replies to whoever asked (the chat, an inline edit, the commit box),
 * even while the AI panel is closed, so nothing is lost mid-answer.
 */
export function AiStreamController(): null {
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
