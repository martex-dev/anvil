import { parentPort } from 'node:worker_threads';

import { AnvilError, errorMessage } from '../../core/errors';
import { DataStore } from './store';
import type { WorkerEnvelope, WorkerResponse } from './worker-protocol';

/** Worker-thread entry: owns the parsed tables and does all the heavy work off the main thread. */
const store = new DataStore();

export async function handle(req: WorkerEnvelope): Promise<WorkerResponse> {
	try {
		switch (req.op) {
			case 'page':
				return { id: req.id, ok: true, value: await store.page(req.spec, req.query) };
			case 'stats':
				return { id: req.id, ok: true, value: await store.stats(req.spec, req.column) };
			case 'evict':
				store.evict(req.abs);
				return { id: req.id, ok: true, value: undefined };
			case 'clear':
				store.clear();
				return { id: req.id, ok: true, value: undefined };
		}
	} catch (error) {
		return {
			id: req.id,
			ok: false,
			code: error instanceof AnvilError ? error.code : null,
			message: errorMessage(error),
			stack: error instanceof Error ? error.stack : undefined,
		};
	}
}

const port = parentPort;
if (port) {
	port.on('message', (req: WorkerEnvelope) => {
		void handle(req).then((res) => port.postMessage(res));
	});
}
