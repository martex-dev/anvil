import type { RegexRequest, RegexResponse } from './regex-runner';
import { testRegex } from './tools';

// Runs off the UI thread: a catastrophic pattern freezes only this worker, which the runner
// terminates after its timeout.
self.addEventListener('message', (event: MessageEvent<RegexRequest>) => {
	const { id, pattern, flags, text } = event.data;
	const response: RegexResponse = { id, result: testRegex(pattern, flags, text) };
	self.postMessage(response);
});
