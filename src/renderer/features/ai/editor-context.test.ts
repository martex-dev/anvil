import { describe, expect, it } from 'vitest';

import { AiContextSchema } from '@shared/ipc/channels/ai';

import { MAX_FILE, truncateForContext } from './editor-context';

describe('truncateForContext', () => {
	it('keeps short text as is', () => {
		expect(truncateForContext('x = 1\n')).toEqual({ text: 'x = 1\n', truncated: false });
	});

	it('cuts long files so the context item still passes the IPC schema', () => {
		const { text, truncated } = truncateForContext('a'.repeat(500_000));
		expect(truncated).toBe(true);
		expect(text.startsWith('a'.repeat(MAX_FILE))).toBe(true);
		expect(text.endsWith('… (truncated)')).toBe(true);
		const item = { kind: 'file', label: 'big.csv', language: null, text };
		expect(AiContextSchema.safeParse(item).success).toBe(true);
	});
});
