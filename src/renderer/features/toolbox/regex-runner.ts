import type { RegexResult } from './tools';

export interface RegexInput {
	pattern: string;
	flags: string;
	text: string;
}

export interface RegexRequest extends RegexInput {
	id: number;
}

export interface RegexResponse {
	id: number;
	result: RegexResult;
}

/** The slice of `Worker` the runner uses, so tests can pass a fake. */
export interface RegexWorkerLike {
	postMessage(message: RegexRequest): void;
	terminate(): void;
	onmessage: ((event: MessageEvent<RegexResponse>) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
}

export type RegexOutcome =
	| { kind: 'result'; result: RegexResult }
	| { kind: 'timeout' }
	| { kind: 'crashed'; message: string };

export interface RegexRunner {
	/** Starts a run; `onDone` fires once unless the returned cancel function runs first. */
	run(input: RegexInput, onDone: (outcome: RegexOutcome) => void): () => void;
	dispose(): void;
}

export const REGEX_TIMEOUT_MS = 1000;

/**
 * Runs testRegex in a worker so a catastrophic pattern like `(a+)+$` cannot freeze the UI.
 * A running exec() cannot be interrupted from inside the worker, so a run that outlives the
 * timeout (or is superseded or cancelled) terminates the worker; the next run starts a fresh one.
 */
export function createRegexRunner(
	createWorker: () => RegexWorkerLike,
	timeoutMs = REGEX_TIMEOUT_MS,
): RegexRunner {
	let worker: RegexWorkerLike | null = null;
	let nextId = 0;
	let inFlight: { id: number; timer: ReturnType<typeof setTimeout> } | null = null;

	const settle = (): void => {
		if (inFlight) clearTimeout(inFlight.timer);
		inFlight = null;
	};
	const kill = (): void => {
		worker?.terminate();
		worker = null;
	};

	return {
		run(input, onDone) {
			// A busy worker would queue this run behind the old one, so replace it instead.
			if (inFlight) {
				settle();
				kill();
			}
			const current = worker ?? createWorker();
			worker = current;
			const id = ++nextId;
			current.onmessage = (event) => {
				if (event.data.id !== id || inFlight?.id !== id) return;
				settle();
				onDone({ kind: 'result', result: event.data.result });
			};
			current.onerror = (event) => {
				if (inFlight?.id !== id) return;
				settle();
				kill();
				onDone({ kind: 'crashed', message: event.message || 'The regex worker failed' });
			};
			inFlight = {
				id,
				timer: setTimeout(() => {
					inFlight = null;
					kill();
					onDone({ kind: 'timeout' });
				}, timeoutMs),
			};
			current.postMessage({ id, ...input });
			return () => {
				if (inFlight?.id !== id) return;
				settle();
				kill();
			};
		},
		dispose() {
			settle();
			kill();
		},
	};
}
