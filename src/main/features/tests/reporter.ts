import { z } from 'zod';

import { REPORT_MARK } from './plugin-source';

const Line = z.number().int().min(1).nullable();

/** The JSON records the plugin prints (see plugin-source.ts). Anything else is ignored. */
export const ReporterRecordSchema = z.discriminatedUnion('t', [
	z.object({
		t: z.literal('item'),
		nodeid: z.string(),
		file: z.string(),
		line: Line,
		classes: z.array(z.object({ nodeid: z.string(), line: Line })),
	}),
	z.object({ t: z.literal('collected'), count: z.number().int() }),
	z.object({ t: z.literal('collecterror'), nodeid: z.string(), message: z.string() }),
	z.object({ t: z.literal('start'), nodeid: z.string() }),
	z.object({ t: z.literal('phase'), nodeid: z.string(), duration: z.number() }),
	z.object({
		t: z.literal('result'),
		nodeid: z.string(),
		outcome: z.enum(['passed', 'failed', 'skipped', 'error']),
		when: z.enum(['setup', 'call', 'teardown']),
		duration: z.number(),
		message: z.string().nullable(),
		longrepr: z.string().nullable(),
		crash: z.object({ path: z.string(), line: z.number().int().min(1) }).nullable(),
	}),
	z.object({ t: z.literal('done'), exitstatus: z.number().int() }),
]);
export type ReporterRecord = z.infer<typeof ReporterRecordSchema>;
export type ItemRecord = Extract<ReporterRecord, { t: 'item' }>;

export interface ReaderChunk {
	records: ReporterRecord[];
	/** Console text with the reporter lines cut out. */
	output: string;
}

/**
 * Splits pytest's stdout into reporter records and the console text a person would have seen.
 * A record can follow progress dots on the same line (`..F@@anvil-pytest {...}`), so the mark is
 * searched anywhere; the text before it stays in the output and the record's newline is dropped,
 * which leaves the dots exactly as pytest printed them.
 */
export class ReporterReader {
	private pending = '';

	push(chunk: string): ReaderChunk {
		this.pending += chunk;
		const records: ReporterRecord[] = [];
		let output = '';
		let newline = this.pending.indexOf('\n');
		while (newline !== -1) {
			output += this.take(this.pending.slice(0, newline + 1), records);
			this.pending = this.pending.slice(newline + 1);
			newline = this.pending.indexOf('\n');
		}
		// A partial line can go out straight away unless it might be the start of a record.
		if (this.pending && !this.pending.includes(REPORT_MARK[0] ?? '@')) {
			output += this.pending;
			this.pending = '';
		}
		return { records, output };
	}

	/** Whatever is left when the process exits. */
	flush(): ReaderChunk {
		const records: ReporterRecord[] = [];
		const output = this.pending ? this.take(this.pending, records) : '';
		this.pending = '';
		return { records, output };
	}

	private take(line: string, records: ReporterRecord[]): string {
		const at = line.indexOf(REPORT_MARK);
		if (at === -1) return line;
		const record = parseRecord(line.slice(at + REPORT_MARK.length));
		if (!record) return line;
		records.push(record);
		return line.slice(0, at);
	}
}

export function parseRecord(json: string): ReporterRecord | null {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		// A test printed something that merely looks like a record; it stays console text.
		return null;
	}
	const parsed = ReporterRecordSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** Records from a whole output (discovery reads everything at once). */
export function readAll(text: string): ReaderChunk {
	const reader = new ReporterReader();
	const first = reader.push(text);
	const rest = reader.flush();
	return { records: [...first.records, ...rest.records], output: first.output + rest.output };
}
