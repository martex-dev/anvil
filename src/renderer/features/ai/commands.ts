import {
	BookText,
	Bot,
	Bug,
	Check,
	FileCode2,
	FlaskConical,
	GitCompare,
	MessageSquarePlus,
	ScanSearch,
	Sparkles,
	Square,
	TextSelect,
	Wand2,
	X,
	Zap,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { getSettings, updateSettings } from '../../app/hooks/use-settings';
import { toast } from '../../stores/toast-store';
import {
	addDocstring,
	checkLookahead,
	explainCode,
	fixProblemsHere,
	focusChat,
	reviewCode,
	vectorize,
	writeTests,
} from './actions';
import { pickModel } from './ai-settings';
import { useChat } from './chat-store';
import { startInlineEdit } from './inline-edit';
import { acceptInline, attachToChat, rejectInline, stopGenerating } from './palette-actions';

export const AI_COMMANDS: Command[] = [
	{
		id: 'ai.inlineEdit',
		title: 'Edit with AI (Inline)',
		category: 'AI',
		shortcut: 'Ctrl+I',
		scope: 'editor',
		icon: Wand2,
		run: () => startInlineEdit(),
	},
	{
		id: 'ai.focusChat',
		title: 'Ask AI',
		category: 'AI',
		shortcut: 'Ctrl+L',
		// Ctrl+L clears the screen in a shell.
		terminalKeepsKey: true,
		keywords: ['chat', 'assistant', 'claude'],
		icon: Bot,
		run: () => focusChat(true),
	},
	{
		id: 'ai.explain',
		title: 'Explain This Code',
		category: 'AI',
		scope: 'editor',
		icon: BookText,
		run: explainCode,
	},
	{
		id: 'ai.review',
		title: 'Find Bugs in This Code',
		category: 'AI',
		scope: 'editor',
		icon: Bug,
		run: reviewCode,
	},
	{
		id: 'ai.tests',
		title: 'Write Tests',
		category: 'AI',
		scope: 'editor',
		icon: FlaskConical,
		run: writeTests,
	},
	{
		id: 'ai.lookahead',
		title: 'Check for Look-Ahead Bias & Leakage',
		category: 'AI',
		scope: 'editor',
		keywords: ['backtest', 'quant', 'leak', 'future'],
		icon: ScanSearch,
		run: checkLookahead,
	},
	{
		id: 'ai.docstring',
		title: 'Add Docstring',
		category: 'AI',
		scope: 'editor',
		icon: BookText,
		run: () => addDocstring(),
	},
	{
		id: 'ai.vectorize',
		title: 'Vectorize (NumPy / pandas / polars)',
		category: 'AI',
		scope: 'editor',
		icon: Zap,
		run: () => vectorize(),
	},
	{
		id: 'ai.fixHere',
		title: 'Fix Problems Here with AI',
		category: 'AI',
		shortcut: 'Ctrl+Alt+.',
		scope: 'editor',
		icon: Sparkles,
		run: fixProblemsHere,
	},
	{
		id: 'ai.stop',
		title: 'Stop Generating',
		category: 'AI',
		keywords: ['cancel', 'abort'],
		icon: Square,
		run: stopGenerating,
	},
	{
		id: 'ai.attachFile',
		title: 'Attach Current File to Chat',
		category: 'AI',
		icon: FileCode2,
		run: () => attachToChat('file'),
	},
	{
		id: 'ai.attachSelection',
		title: 'Attach Selection to Chat',
		category: 'AI',
		icon: TextSelect,
		run: () => attachToChat('selection'),
	},
	{
		id: 'ai.attachDiff',
		title: 'Attach Git Diff to Chat',
		category: 'AI',
		icon: GitCompare,
		run: () => attachToChat('diff'),
	},
	{
		id: 'ai.inlineAccept',
		title: 'Accept Inline Edit',
		category: 'AI',
		icon: Check,
		run: acceptInline,
	},
	{
		id: 'ai.inlineReject',
		title: 'Reject Inline Edit',
		category: 'AI',
		icon: X,
		run: rejectInline,
	},
	{
		id: 'ai.newChat',
		title: 'New AI Conversation',
		category: 'AI',
		icon: MessageSquarePlus,
		run: () => useChat.getState().clear(),
	},
	{
		id: 'ai.chatModel',
		title: 'Choose Chat Model…',
		category: 'AI',
		keywords: ['claude', 'gpt', 'gemini', 'ollama'],
		run: () => pickModel('chat'),
	},
	{
		id: 'ai.completionModel',
		title: 'Choose Autocomplete Model…',
		category: 'AI',
		run: () => pickModel('completion'),
	},
	{
		id: 'ai.toggleGhost',
		title: 'Toggle AI Autocomplete',
		category: 'AI',
		keywords: ['ghost', 'copilot', 'inline suggestions'],
		run: async () => {
			const on = !getSettings().ghostText;
			await updateSettings({ ghostText: on });
			toast.info(`AI autocomplete ${on ? 'on' : 'off'}`);
		},
	},
];
