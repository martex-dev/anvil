import { afterEach, describe, expect, it, vi } from 'vitest';

import { call } from '../../lib/ipc';
import { attachDiff } from './chat-attach';
import { useChat } from './chat-store';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

afterEach(() => {
	vi.mocked(call).mockReset();
});

describe('attachDiff', () => {
	it('shares one git diff run between repeated clicks', async () => {
		let finish: (value: { diff: string; truncated: boolean }) => void = () => undefined;
		vi.mocked(call).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			}) as ReturnType<typeof call>,
		);
		const first = attachDiff();
		const second = attachDiff();
		expect(second).toBe(first);
		expect(call).toHaveBeenCalledTimes(1);
		finish({ diff: 'diff --git a/x b/x\n+1', truncated: false });
		await first;
		expect(useChat.getState().attached.some((c) => c.kind === 'diff')).toBe(true);

		// Once finished, the next click runs git again.
		vi.mocked(call).mockResolvedValue({ diff: '', truncated: false } as never);
		await attachDiff();
		expect(call).toHaveBeenCalledTimes(2);
	});
});
