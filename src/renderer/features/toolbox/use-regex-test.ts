import { useEffect, useRef, useState } from 'react';

import RegexWorker from './regex.worker?worker';
import { createRegexRunner, type RegexOutcome, type RegexRunner } from './regex-runner';

// Long enough to skip the intermediate states of a pattern being typed, short enough to feel live.
const DEBOUNCE_MS = 150;

export interface RegexTestState {
	/** The latest finished run; while `pending` it still describes the previous inputs. */
	outcome: RegexOutcome | null;
	pending: boolean;
}

interface Finished {
	pattern: string;
	flags: string;
	text: string;
	outcome: RegexOutcome;
}

/** Debounced, worker-backed testRegex; see createRegexRunner for the timeout behaviour. */
export function useRegexTest(pattern: string, flags: string, text: string): RegexTestState {
	const [finished, setFinished] = useState<Finished | null>(null);
	const runnerRef = useRef<RegexRunner | null>(null);

	useEffect(() => {
		if (pattern === '') return;
		let cancel: (() => void) | undefined;
		const timer = setTimeout(() => {
			runnerRef.current ??= createRegexRunner(() => new RegexWorker());
			cancel = runnerRef.current.run({ pattern, flags, text }, (outcome) =>
				setFinished({ pattern, flags, text, outcome }),
			);
		}, DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			cancel?.();
		};
	}, [pattern, flags, text]);

	useEffect(
		() => () => {
			runnerRef.current?.dispose();
			runnerRef.current = null;
		},
		[],
	);

	if (pattern === '') return { outcome: null, pending: false };
	const current =
		finished !== null &&
		finished.pattern === pattern &&
		finished.flags === flags &&
		finished.text === text;
	return { outcome: finished?.outcome ?? null, pending: !current };
}
