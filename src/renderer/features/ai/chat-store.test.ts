import { describe, expect, it, vi } from 'vitest';

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

describe('chat per folder', () => {
	it('switches to the opened folder’s conversation and drops the old attachments', () => {
		const saved = new Map<string, string>([
			['anvil.chat:C:\\b', JSON.stringify([{ id: 'b1', role: 'user', content: 'about b' }])],
		]);
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => saved.get(k) ?? null,
			setItem: (k: string, v: string) => void saved.set(k, v),
			removeItem: (k: string) => void saved.delete(k),
		});
		useChat.setState({
			workspace: 'C:\\a',
			activeRequest: null,
			messages: [{ id: 'a1', role: 'user', content: 'about a' }],
			attached: [{ kind: 'file', label: 'a.py', language: null, text: 'x' }],
		});

		useChat.getState().openWorkspace('C:\\b');

		expect(useChat.getState().messages.map((m) => m.content)).toEqual(['about b']);
		expect(useChat.getState().attached).toEqual([]);
		// Folder A's conversation was saved on the way out.
		expect(saved.get('anvil.chat:C:\\a')).toContain('about a');
		vi.unstubAllGlobals();
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

describe('chat retry', () => {
	const model = { provider: 'openai' as const, model: 'gpt-5' };

	it('resends the question with its context and replaces the failed reply', () => {
		const context = [{ kind: 'file' as const, label: 'a.py', language: null, text: 'x = 1' }];
		useChat.setState({
			activeRequest: null,
			attached: [],
			messages: [
				{ id: 'u1', role: 'user', content: 'why?', context },
				{ id: 'a1', role: 'assistant', content: '', error: 'Rate limited' },
			],
		});
		expect(useChat.getState().retry('a1', model)).toBe(true);
		const { messages, activeRequest } = useChat.getState();
		expect(messages[0]?.id).toBe('u1');
		expect(messages).toHaveLength(2);
		expect(messages[1]).toMatchObject({ role: 'assistant', streaming: true, model });
		expect(messages[1]?.id).toBe(activeRequest);
		expect(messages[0]?.context).toEqual(context);
	});

	it('only retries the latest failed reply, and not while another is streaming', () => {
		useChat.setState({
			activeRequest: null,
			messages: [
				{ id: 'u1', role: 'user', content: 'q1' },
				{ id: 'a1', role: 'assistant', content: '', error: 'Failed' },
				{ id: 'u2', role: 'user', content: 'q2' },
				{ id: 'a2', role: 'assistant', content: 'ok' },
			],
		});
		expect(useChat.getState().retry('a1', model)).toBe(false);
		expect(useChat.getState().retry('a2', model)).toBe(false);
		useChat.setState({
			activeRequest: 'busy',
			messages: [
				{ id: 'u1', role: 'user', content: 'q1' },
				{ id: 'a1', role: 'assistant', content: '', error: 'Failed' },
			],
		});
		expect(useChat.getState().retry('a1', model)).toBe(false);
	});
});

describe('chat stop', () => {
	it('marks a reply stopped part-way as stopped, keeping its text', () => {
		useChat.setState({
			activeRequest: 'r1',
			messages: [{ id: 'r1', role: 'assistant', content: 'half an', streaming: true }],
		});
		useChat.getState().onDone('r1', { inputTokens: 1, outputTokens: 2 }, true);
		expect(useChat.getState().messages[0]).toMatchObject({
			content: 'half an',
			streaming: false,
			stopped: true,
		});
		expect(useChat.getState().messages[0]?.error).toBeUndefined();
	});

	it('does not mark a reply that finished normally', () => {
		useChat.setState({
			activeRequest: 'r2',
			messages: [{ id: 'r2', role: 'assistant', content: 'done', streaming: true }],
		});
		useChat.getState().onDone('r2', { inputTokens: 1, outputTokens: 2 }, false);
		expect(useChat.getState().messages[0]?.stopped).toBeUndefined();
	});
});

describe('chat attach', () => {
	const file = (label: string) => ({ kind: 'file' as const, label, language: null, text: 'x' });

	it('refuses more than 20 attachments with a toast, but still refreshes one', () => {
		useToastStore.setState({ toasts: [] });
		useChat.setState({ attached: [] });
		for (let i = 0; i < 20; i++) useChat.getState().attach(file(`f${i}.py`));
		useChat.getState().attach(file('one-too-many.py'));
		expect(useChat.getState().attached).toHaveLength(20);
		expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Up to 20 attachments');
		useChat.getState().attach(file('f3.py'));
		expect(useChat.getState().attached.at(-1)?.label).toBe('f3.py');
	});

	it('masks secrets in what it attaches and says so', () => {
		const key = `sk-ant-${'a1B2'.repeat(10)}`;
		useToastStore.setState({ toasts: [] });
		useChat.setState({ attached: [] });
		useChat.getState().attach({
			kind: 'file',
			label: 'app.py',
			language: 'python',
			text: `client = Anthropic(api_key="${key}")`,
		});
		expect(useChat.getState().attached[0]?.text).not.toContain(key);
		expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Secrets kept out of the chat');
	});

	it('clamps a label to what the request allows', () => {
		useChat.setState({ attached: [] });
		useChat.getState().attach(file('x'.repeat(600)));
		expect(useChat.getState().attached[0]?.label).toHaveLength(500);
	});
});
