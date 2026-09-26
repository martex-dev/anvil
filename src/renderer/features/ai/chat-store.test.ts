import { describe, expect, it } from 'vitest';

import { useToastStore } from '../../stores/toast-store';
import { useChat } from './chat-store';

describe('chat send', () => {
	it('refuses a second message while a reply is streaming, so the draft can be kept', () => {
		const model = { provider: 'anthropic' as const, model: 'claude-opus-5' };
		expect(useChat.getState().send('first', model)).toBe(true);
		expect(useChat.getState().activeRequest).not.toBeNull();
		expect(useChat.getState().send('second', model)).toBe(false);
		expect(useChat.getState().messages.filter((m) => m.role === 'user')).toHaveLength(1);
		expect(useChat.getState().send('   ', model)).toBe(false);
	});
});

describe('chat draft', () => {
	it('keeps the unsent message in the store, outside the panel component', () => {
		useChat.getState().setDraft('half a question');
		expect(useChat.getState().draft).toBe('half a question');
	});
});

describe('chat clear', () => {
	it('offers an Undo toast that restores the cleared conversation', () => {
		useToastStore.setState({ toasts: [] });
		useChat.setState({
			activeRequest: null,
			messages: [{ id: 'u1', role: 'user', content: 'keep me' }],
		});
		useChat.getState().clear();
		expect(useChat.getState().messages).toHaveLength(0);
		const undo = useToastStore.getState().toasts.at(-1)?.action;
		expect(undo?.label).toBe('Undo');
		undo?.run();
		expect(useChat.getState().messages.map((m) => m.content)).toEqual(['keep me']);
	});

	it('marks a reply that was cut off by clearing as stopped when restored', () => {
		useChat.getState().restore([{ id: 'a1', role: 'assistant', content: '', streaming: true }]);
		const restored = useChat.getState().messages.find((m) => m.id === 'a1');
		expect(restored).toMatchObject({ streaming: false, error: 'Stopped' });
	});

	it('does not offer Undo for an already empty conversation', () => {
		useToastStore.setState({ toasts: [] });
		useChat.setState({ activeRequest: null, messages: [] });
		useChat.getState().clear();
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});
});
