import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';
import { askChat } from './actions';
import { useChat } from './chat-store';

vi.mock('./ai-settings', () => ({
	getAiSettings: vi.fn(() =>
		Promise.resolve({ chat: { provider: 'anthropic', model: 'claude-opus-5' } }),
	),
}));

const file = { kind: 'file' as const, label: 'a.py', language: null, text: 'x = 1' };

beforeEach(() => {
	useToastStore.setState({ toasts: [] });
	useChat.setState({ messages: [], attached: [], activeRequest: null });
});

describe('askChat', () => {
	it('attaches nothing and says why while a reply is streaming', async () => {
		useChat.setState({ activeRequest: 'busy' });
		await askChat('Explain', [file]);
		expect(useChat.getState().attached).toEqual([]);
		expect(useChat.getState().messages).toHaveLength(0);
		expect(useToastStore.getState().toasts.at(-1)?.title).toBe('A reply is still streaming');
	});

	it('sends the prompt with the context attached', async () => {
		await askChat('Explain', [file]);
		const user = useChat.getState().messages[0];
		expect(user).toMatchObject({ role: 'user', content: 'Explain', context: [file] });
		expect(useChat.getState().attached).toEqual([]);
	});
});
