import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { useBreakpoints } from './breakpoints';

/** The Python file and line the cursor is on, or null (with a hint) elsewhere. */
function cursorPlace(): { path: string; line: number } | null {
	const editor = focusedEditor();
	const model = editor?.getModel();
	const path = model ? toWorkspacePath(model.uri) : null;
	const line = editor?.getPosition()?.lineNumber;
	if (!model || !path || !line || model.getLanguageId() !== 'python') {
		toast.info('Breakpoints go in Python files', 'Put the cursor on a line of a .py file.');
		return null;
	}
	return { path, line };
}

export function toggleBreakpointAtCursor(): void {
	const at = cursorPlace();
	if (at) useBreakpoints.getState().toggle(at.path, at.line);
}

const REMOVE = '__remove';

const PROMPTS = {
	condition: {
		title: 'Conditional breakpoint',
		placeholder: 'Stop only when this Python expression is true, e.g. i == 10',
		verb: (t: string) => `Stop when ${t}`,
	},
	hitCondition: {
		title: 'Hit count breakpoint',
		placeholder: 'Stop on the n-th hit: 5, >= 10, % 3',
		verb: (t: string) => `Stop when the hit count is ${t}`,
	},
	logMessage: {
		title: 'Logpoint',
		placeholder: 'Print instead of stopping; {expressions} are evaluated, e.g. loss={loss:.4f}',
		verb: (t: string) => `Log "${t}"`,
	},
} as const;

export type BreakpointField = keyof typeof PROMPTS;

/** Asks for a condition, hit count or log message for the breakpoint on a line. */
export async function editBreakpoint(
	path: string,
	line: number,
	field: BreakpointField,
): Promise<void> {
	const prompt = PROMPTS[field];
	const existing = useBreakpoints
		.getState()
		.items.find((b) => b.path === path && b.line === line);
	const current = existing?.[field];
	const answer = await quickPick({
		title: `${prompt.title} (line ${line})`,
		placeholder: prompt.placeholder,
		items: current
			? [
					{
						id: current,
						label: prompt.verb(current),
						description: 'current',
						current: true,
					},
					{
						id: REMOVE,
						label: `Remove the ${field === 'logMessage' ? 'log message' : 'condition'}`,
					},
				]
			: [],
		allowCustom: { label: prompt.verb },
	});
	if (answer === null) return;
	const value = answer === REMOVE ? undefined : answer;
	useBreakpoints.getState().set(path, line, {
		condition: existing?.condition,
		hitCondition: existing?.hitCondition,
		logMessage: existing?.logMessage,
		[field]: value,
	});
}

export async function editBreakpointAtCursor(field: BreakpointField): Promise<void> {
	const at = cursorPlace();
	if (at) await editBreakpoint(at.path, at.line, field);
}
