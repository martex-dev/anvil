import type { Worker } from 'node:worker_threads';

import { AnvilError } from '../../core/errors';
import type { WorkerRequest, WorkerResponse, WorkerResults } from './worker-protocol';

/**
 * Worker scripts are unpacked from app.asar (electron-builder.yml): a Node worker thread may not
 * be able to load its entry file from inside the archive.
 */
export function unpackedPath(path: string): string {
	return path.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2');
}

interface Pending {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
}

interface ClientLogger {
	error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Talks to the data worker thread. The worker starts on first use and is restarted on the
 * next call if it crashes (for example out of memory on a huge file).
 */
export class DataWorkerClient {
	private worker: Worker | null = null;
	private nextId = 1;
	private readonly pending = new Map<number, Pending>();

	constructor(
		private readonly spawn: () => Worker,
		private readonly log: ClientLogger,
	) {}

	call<R extends WorkerRequest>(req: R): Promise<WorkerResults[R['op']]> {
		const worker = this.ensure();
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, {
				resolve: (value) => resolve(value as WorkerResults[R['op']]),
				reject,
			});
			worker.postMessage({ ...req, id });
		});
	}

	/** Sends a request only if the worker is running (nothing to clear otherwise). */
	notify(req: WorkerRequest): void {
		if (!this.worker) return;
		this.call(req).catch((error: unknown) => {
			this.log.error(`[data] worker ${req.op} failed`, { error: String(error) });
		});
	}

	async dispose(): Promise<void> {
		const worker = this.worker;
		this.worker = null;
		if (worker) await worker.terminate();
		this.failAll(new AnvilError('DATA_WORKER_STOPPED', 'The data reader was stopped'));
	}

	private ensure(): Worker {
		if (this.worker) return this.worker;
		const worker = this.spawn();
		// The worker must never keep the app from quitting.
		worker.unref();
		worker.on('message', (res: WorkerResponse) => this.settle(res));
		worker.on('error', (error) => {
			this.log.error('[data] worker crashed', { error: error.message, stack: error.stack });
		});
		worker.on('exit', (code) => {
			if (this.worker === worker) this.worker = null;
			this.failAll(
				new AnvilError(
					'DATA_WORKER_FAILED',
					`The data reader stopped unexpectedly (exit code ${code}). The file may be too large to preview.`,
				),
			);
		});
		this.worker = worker;
		return worker;
	}

	private settle(res: WorkerResponse): void {
		const pending = this.pending.get(res.id);
		if (!pending) return;
		this.pending.delete(res.id);
		if (res.ok) {
			pending.resolve(res.value);
			return;
		}
		if (res.code !== null) {
			pending.reject(new AnvilError(res.code, res.message));
			return;
		}
		// Unexpected failure: keep it a plain Error so the IPC router logs it as a crash.
		const error = new Error(res.message);
		if (res.stack) error.stack = res.stack;
		pending.reject(error);
	}

	private failAll(error: Error): void {
		const pending = [...this.pending.values()];
		this.pending.clear();
		for (const p of pending) p.reject(error);
	}
}
