import { type Capabilities, num, type StackFrame, str } from './dap-types';

/**
 * idle → starting → running ⇄ paused → stopping → idle. `stopping` covers the gap between the
 * program ending (or Stop) and main reporting that the adapter has exited.
 */
export type DebugStatus = 'idle' | 'starting' | 'running' | 'paused' | 'stopping';

export type ConsoleKind = 'input' | 'result' | 'error' | 'output' | 'info';

export interface ConsoleLine {
	id: number;
	kind: ConsoleKind;
	text: string;
}

export interface DebugState {
	status: DebugStatus;
	session: string | null;
	/** What is being debugged ("main.py", "-m pkg", "test_x"). */
	label: string;
	capabilities: Capabilities;
	/** The thread that stopped; step and continue act on it. */
	threadId: number | null;
	/** Why the program is paused ("breakpoint", "step", "exception"…) and any detail text. */
	stopReason: string | null;
	stopDetail: string | null;
	frames: StackFrame[];
	/** The frame the Variables view, the Debug Console and hovers evaluate in. */
	frameId: number | null;
	/**
	 * Bumped on every stop. Variable references are only valid until the program runs again,
	 * so cached variables and watches are keyed by it.
	 */
	generation: number;
	console: ConsoleLine[];
	/** Why the last session failed, shown in the Debug view until the next start. */
	error: string | null;
	/** debugpy is missing from the environment named here; `command` installs it. */
	install: { env: string; command: string } | null;
}

export type DebugAction =
	| { type: 'starting'; label: string }
	| { type: 'started'; session: string }
	| { type: 'capabilities'; capabilities: Capabilities }
	| { type: 'event'; event: string; body: Record<string, unknown> }
	| { type: 'frames'; threadId: number; frames: StackFrame[] }
	| { type: 'selectFrame'; frameId: number }
	| { type: 'stopDetail'; text: string }
	| { type: 'console'; kind: ConsoleKind; text: string }
	| { type: 'clearConsole' }
	| { type: 'stopping' }
	| {
			type: 'ended';
			error?: string | undefined;
			install?: { env: string; command: string } | undefined;
	  };

/** Keeps the Debug Console from growing without bound in a chatty loop of logpoints. */
export const MAX_CONSOLE_LINES = 2000;

export const INITIAL_DEBUG_STATE: DebugState = {
	status: 'idle',
	session: null,
	label: '',
	capabilities: {},
	threadId: null,
	stopReason: null,
	stopDetail: null,
	frames: [],
	frameId: null,
	generation: 0,
	console: [],
	error: null,
	install: null,
};

let lineId = 1;

function withLine(state: DebugState, kind: ConsoleKind, text: string): DebugState {
	const line = { id: lineId++, kind, text };
	const console = [...state.console, line];
	return {
		...state,
		console: console.length > MAX_CONSOLE_LINES ? console.slice(-MAX_CONSOLE_LINES) : console,
	};
}

const running = (state: DebugState): DebugState => ({
	...state,
	status: 'running',
	stopReason: null,
	stopDetail: null,
	frames: [],
	frameId: null,
});

function onEvent(state: DebugState, event: string, body: Record<string, unknown>): DebugState {
	switch (event) {
		case 'stopped': {
			if (state.status === 'idle' || state.status === 'stopping') return state;
			const reason = str(body['reason']) ?? 'pause';
			return {
				...state,
				status: 'paused',
				threadId: num(body['threadId']) ?? state.threadId,
				stopReason: reason,
				stopDetail: str(body['text']) ?? str(body['description']) ?? null,
				frames: [],
				frameId: null,
				generation: state.generation + 1,
			};
		}
		case 'continued':
			return state.status === 'paused' ? running(state) : state;
		case 'output': {
			// debugpy reports its version as telemetry; nobody wants that in the console.
			const category = str(body['category']) ?? 'console';
			const text = str(body['output']);
			if (category === 'telemetry' || !text) return state;
			const kind: ConsoleKind = category === 'stderr' ? 'error' : 'output';
			return withLine(state, kind, text.replace(/\r?\n$/, ''));
		}
		case 'exited': {
			const code = num(body['exitCode']);
			return withLine(state, 'info', `Program exited with code ${code ?? '?'}`);
		}
		case 'terminated':
			return state.status === 'idle' ? state : { ...running(state), status: 'stopping' };
		default:
			return state;
	}
}

/** Pure state machine of a debug session; the store applies it, the tests drive it. */
export function debugReducer(state: DebugState, action: DebugAction): DebugState {
	switch (action.type) {
		case 'starting':
			// A new run starts with a clean console and no error from the last one.
			return {
				...INITIAL_DEBUG_STATE,
				status: 'starting',
				label: action.label,
				generation: state.generation,
			};
		case 'started':
			return state.status === 'starting'
				? { ...state, status: 'running', session: action.session }
				: state;
		case 'capabilities':
			return { ...state, capabilities: action.capabilities };
		case 'event':
			return onEvent(state, action.event, action.body);
		case 'frames':
			if (state.status !== 'paused' || action.threadId !== state.threadId) return state;
			return { ...state, frames: action.frames, frameId: action.frames[0]?.id ?? null };
		case 'selectFrame':
			return state.frames.some((f) => f.id === action.frameId)
				? { ...state, frameId: action.frameId }
				: state;
		case 'stopDetail':
			return state.status === 'paused' ? { ...state, stopDetail: action.text } : state;
		case 'console':
			return withLine(state, action.kind, action.text);
		case 'clearConsole':
			return { ...state, console: [] };
		case 'stopping':
			return state.status === 'idle' ? state : { ...running(state), status: 'stopping' };
		case 'ended':
			return {
				...state,
				status: 'idle',
				session: null,
				threadId: null,
				stopReason: null,
				stopDetail: null,
				frames: [],
				frameId: null,
				error: action.error ?? null,
				install: action.install ?? null,
			};
	}
}

/** The frame the views evaluate in, if the program is paused. */
export function selectedFrame(state: DebugState): StackFrame | null {
	return state.frames.find((f) => f.id === state.frameId) ?? null;
}

/** A session is live (the debug keys F5, F10, F11… belong to it). */
export const isDebugging = (state: Pick<DebugState, 'status'>): boolean => state.status !== 'idle';
