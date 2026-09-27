import type { TestRunEvent } from '@shared/ipc/channels/tests';

import type { ReporterRecord } from './reporter';

/**
 * Turns the plugin's records of one run into the events the renderer gets. pytest reports setup,
 * call and teardown separately; a passing setup only adds to the test's duration, so a result
 * carries the time spent from setup to its own phase.
 */
export class RunTranslator {
	private readonly durations = new Map<string, number>();
	private collected: string[] = [];
	/** pytest's exit status as the plugin saw it; null until the session finished. */
	exitStatus: number | null = null;
	/** Whether pytest got as far as loading the plugin (it's missing or broken otherwise). */
	sawRecord = false;

	constructor(private readonly runId: number) {}

	translate(record: ReporterRecord): TestRunEvent[] {
		this.sawRecord = true;
		const runId = this.runId;
		switch (record.t) {
			case 'item':
				this.collected.push(record.nodeid);
				return [];
			case 'collected': {
				const ids = this.collected;
				this.collected = [];
				return [{ type: 'queued', runId, ids }];
			}
			case 'start':
				return [{ type: 'running', runId, id: record.nodeid }];
			case 'phase':
				this.addTime(record.nodeid, record.duration);
				return [];
			case 'result': {
				const duration = (this.durations.get(record.nodeid) ?? 0) + record.duration;
				this.durations.delete(record.nodeid);
				return [
					{
						type: 'result',
						runId,
						result: {
							id: record.nodeid,
							outcome: record.outcome,
							duration,
							message: record.message,
							traceback: record.longrepr,
							crash: record.crash,
						},
					},
				];
			}
			case 'collecterror':
				return [
					{ type: 'collectError', runId, id: record.nodeid, message: record.message },
				];
			case 'done':
				this.exitStatus = record.exitstatus;
				return [];
		}
	}

	private addTime(id: string, seconds: number): void {
		this.durations.set(id, (this.durations.get(id) ?? 0) + seconds);
	}
}

/** pytest exit codes that mean it never got to run tests properly. */
const BROKEN_EXIT: Record<number, string> = {
	3: 'pytest hit an internal error',
	4: 'pytest rejected its command line or configuration',
};

/**
 * Why a finished run is an error rather than a result: pytest missing, crashed or misconfigured.
 * Failing tests are not an error (exit 1), and neither are collection errors (exit 2).
 */
export function runError(options: {
	exitCode: number | null;
	cancelled: boolean;
	sawRecord: boolean;
	output: string;
	python: string;
}): string | null {
	const { exitCode, cancelled, sawRecord, output, python } = options;
	if (cancelled) return null;
	if (pytestMissing(output))
		return `pytest isn't installed in ${python}. Install it into that environment.`;
	const detail = lastLine(output);
	const broken = exitCode === null ? null : BROKEN_EXIT[exitCode];
	if (broken) return detail ? `${broken}: ${detail}` : broken;
	if (!sawRecord) return detail ? `pytest did not run: ${detail}` : 'pytest did not run';
	return null;
}

/** True when the output says the interpreter has no pytest. */
export function pytestMissing(output: string): boolean {
	return /No module named pytest\b/.test(output);
}

/** Last non-empty line of some output, for short error messages. */
export function lastLine(text: string): string | null {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l !== '');
	return lines.at(-1) ?? null;
}
