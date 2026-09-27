import { describe, expect, it } from 'vitest';

import { applyWarnings, locateSelection, replyTargets } from './apply-target';
import type { ChatMessage } from './chat-store';

const ask = (id: string, context: ChatMessage['context'] = []): ChatMessage => ({
	id,
	role: 'user',
	content: id,
	context,
});
const reply = (id: string): ChatMessage => ({ id, role: 'assistant', content: 'ok' });

describe('replyTargets', () => {
	it('points a reply at the selection its question was about', () => {
		const targets = replyTargets([
			ask('q1', [
				{ kind: 'file', label: 'src/a.py', language: 'python', text: 'x' },
				{ kind: 'selection', label: 'src/a.py:3-5', language: 'python', text: 'def f():' },
			]),
			reply('r1'),
		]);
		expect(targets).toEqual([
			null,
			{ path: 'src/a.py', selection: { startLine: 3, endLine: 5, text: 'def f():' } },
		]);
	});

	it('keeps the earlier target for a follow-up that attached nothing', () => {
		const targets = replyTargets([
			ask('q1', [{ kind: 'file', label: 'b.py', language: null, text: 'y' }]),
			reply('r1'),
			ask('q2'),
			reply('r2'),
			ask('q3', [{ kind: 'diff', label: 'git diff', language: 'diff', text: '+x' }]),
			reply('r3'),
		]);
		expect(targets[3]).toEqual({ path: 'b.py', selection: null });
		expect(targets[5]).toEqual({ path: 'b.py', selection: null });
	});

	it('has no target when no question named a file', () => {
		expect(replyTargets([ask('q1'), reply('r1')])).toEqual([null, null]);
	});
});

describe('locateSelection', () => {
	const file = 'import x\n\ndef f():\n    return 1\n\ndef g():\n    return 1\n';

	it('finds the asked-about lines after edits moved them', () => {
		expect(
			locateSelection(`# header\n${file}`, {
				startLine: 3,
				endLine: 4,
				text: 'def f():\n    return 1',
			}),
		).toEqual({ startLine: 4, endLine: 5 });
	});

	it('prefers the copy nearest the old lines', () => {
		expect(locateSelection(file, { startLine: 7, endLine: 7, text: '    return 1' })).toEqual({
			startLine: 7,
			endLine: 7,
		});
	});

	it('reports text that is gone, and trusts lines restored without text', () => {
		expect(locateSelection(file, { startLine: 3, endLine: 4, text: 'def h():' })).toBeNull();
		expect(locateSelection(file, { startLine: 3, endLine: 4, text: '' })).toEqual({
			startLine: 3,
			endLine: 4,
		});
		expect(locateSelection(file, { startLine: 30, endLine: 40, text: '' })).toBeNull();
	});
});

describe('applyWarnings', () => {
	const long = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
	const base = { path: 'a.py', stale: false, original: long, block: 'x = 1', wholeFile: false };

	it('says nothing about an ordinary line edit', () => {
		expect(applyWarnings(base)).toEqual([]);
	});

	it('flags a stale preview, a snippet replacing a whole file, and masked secrets', () => {
		expect(applyWarnings({ ...base, stale: true })[0]).toMatch(/changed after this preview/);
		expect(applyWarnings({ ...base, wholeFile: true })[0]).toMatch(/all 40 lines/);
		expect(applyWarnings({ ...base, block: 'key = "sk-a••••••••1234"' })[0]).toMatch(
			/masked secrets/,
		);
	});
});
