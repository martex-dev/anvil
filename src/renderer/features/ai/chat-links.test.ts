import { afterEach, describe, expect, it, vi } from 'vitest';

import { call } from '../../lib/ipc';
import { useToastStore } from '../../stores/toast-store';
import { openChatLink } from './chat-links';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

afterEach(() => {
	vi.mocked(call).mockReset();
	vi.unstubAllGlobals();
	useToastStore.setState({ toasts: [] });
});

describe('openChatLink', () => {
	it('opens https links externally', () => {
		vi.mocked(call).mockResolvedValue(undefined as never);
		openChatLink('https://pandas.pydata.org/docs/');
		expect(call).toHaveBeenCalledWith('app:openExternal', 'https://pandas.pydata.org/docs/');
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it('explains other links and offers to copy them', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		openChatLink('http://example.com');
		expect(call).not.toHaveBeenCalled();
		const shown = useToastStore.getState().toasts.at(-1);
		expect(shown?.title).toBe('Link not opened');
		shown?.action?.run();
		expect(writeText).toHaveBeenCalledWith('http://example.com');
		await vi.waitFor(() =>
			expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Link copied'),
		);
	});
});
