import {
	BookText,
	Bot,
	Bug,
	FlaskConical,
	MessageSquarePlus,
	ScanSearch,
	Sparkles,
	Wand2,
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
