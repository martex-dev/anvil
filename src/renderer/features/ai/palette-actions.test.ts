import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';
import { useChat } from './chat-store';
import { acceptInlineEdit, cancelInlineEdit, useInlineEdit } from './inline-edit';
import { acceptInline, rejectInline, stopGenerating } from './palette-actions';

vi.mock('./inline-edit', async () => {
	const { create } = await import('zustand');
	return {
		useInlineEdit: create<{ phase: string | null }>(() => ({ phase: null })),
		acceptInlineEdit: vi.fn(),
		cancelInlineEdit: vi.fn(),
	};
});

beforeEach(() => {
	vi.mocked(acceptInlineEdit).mockReset();
	vi.mocked(cancelInlineEdit).mockReset();
	useToastStore.setState({ toasts: [] });
	useInlineEdit.setState({ phase: null });
	useChat.setState({ activeRequest: null });
});

describe('stopGenerating', () => {
	it('stops a generating inline edit when no chat reply is streaming', () => {
		useInlineEdit.setState({ phase: 'generating' });
		stopGenerating();
		expect(cancelInlineEdit).toHaveBeenCalledTimes(1);
	});

	it('says so when nothing is generating', () => {
		stopGenerating();
		expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Nothing is generating');
	});
});

describe('inline accept and reject', () => {
	it('accepts only a change under review', () => {
		useInlineEdit.setState({ phase: 'prompt' });
		acceptInline();
		expect(acceptInlineEdit).not.toHaveBeenCalled();
		useInlineEdit.setState({ phase: 'review' });
		acceptInline();
		expect(acceptInlineEdit).toHaveBeenCalledTimes(1);
	});

	it('rejects any open inline edit', () => {
		rejectInline();
		expect(cancelInlineEdit).not.toHaveBeenCalled();
		useInlineEdit.setState({ phase: 'review' });
		rejectInline();
		expect(cancelInlineEdit).toHaveBeenCalledTimes(1);
	});
});
