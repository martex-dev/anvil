import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatKey, loadChat, saveChat } from './chat-persist';
import type { ChatMessage } from './chat-store';

/** A Map-backed localStorage for the node test environment. */
function memoryStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (k) => data.get(k) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (k) => void data.delete(k),
		setItem: (k, v) => void data.set(k, v),
	};
}

const msg = (content: string): ChatMessage => ({ id: content, role: 'user', content });

beforeEach(() => {
	vi.stubGlobal('localStorage', memoryStorage());
});

describe('chat persistence', () => {
	it('keeps a separate conversation per folder', () => {
		saveChat('C:\\proj\\a', [msg('about a')]);
		saveChat('C:\\proj\\b', [msg('about b')]);
		expect(loadChat('C:\\proj\\a').map((m) => m.content)).toEqual(['about a']);
		expect(loadChat('C:\\proj\\b').map((m) => m.content)).toEqual(['about b']);
		expect(loadChat(null)).toEqual([]);
	});

	it('gives the old shared conversation to the first folder opened, once', () => {
		localStorage.setItem('anvil.chat', JSON.stringify([msg('from before')]));
		expect(loadChat(null)).toEqual([]);
		expect(loadChat('C:\\first').map((m) => m.content)).toEqual(['from before']);
		expect(localStorage.getItem('anvil.chat')).toBeNull();
		expect(loadChat('C:\\second')).toEqual([]);
	});

	it('saves without attachment text and restores a cut-off reply as stopped', () => {
		saveChat('C:\\a', [
			{ ...msg('q'), context: [{ kind: 'file', label: 'a.py', language: null, text: 'x' }] },
			{ id: 'r', role: 'assistant', content: '', streaming: true },
		]);
		const [q, r] = loadChat('C:\\a');
		expect(q?.context?.[0]?.text).toBe('');
		expect(r).toMatchObject({ streaming: false, stopped: true, error: 'Stopped' });
	});

	it('forgets the least recently used folders beyond its limit', () => {
		for (let i = 0; i < 31; i++) saveChat(`C:\\p${i}`, [msg(`p${i}`)]);
		expect(localStorage.getItem(chatKey('C:\\p0'))).toBeNull();
		expect(localStorage.getItem(chatKey('C:\\p1'))).not.toBeNull();
		expect(localStorage.getItem(chatKey('C:\\p30'))).not.toBeNull();
	});
});
