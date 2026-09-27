import { describe, expect, it } from 'vitest';

import { REPORT_MARK } from './plugin-source';
import { parseRecord, readAll, ReporterReader } from './reporter';

const M = REPORT_MARK;
const start = `${M}{"t": "start", "nodeid": "tests/test_a.py::test_ok"}\n`;
const passed = `${M}{"t": "result", "nodeid": "tests/test_a.py::test_ok", "outcome": "passed", "when": "call", "duration": 0.0006, "message": null, "longrepr": null, "crash": null}\n`;

describe('ReporterReader', () => {
	it('separates records from console output', () => {
		const { records, output } = readAll(`${start}.${passed}   [100%]\n1 passed in 0.01s\n`);
		expect(records.map((r) => r.t)).toEqual(['start', 'result']);
		// The dot stays where pytest printed it; the record's own newline disappears.
		expect(output).toBe('.   [100%]\n1 passed in 0.01s\n');
	});

	it('reassembles records split across chunks', () => {
		const reader = new ReporterReader();
		const text = `F${passed}`;
		const cut = text.length / 2;
		const first = reader.push(text.slice(0, cut));
		expect(first.records).toEqual([]);
		const second = reader.push(text.slice(cut));
		expect(second.records).toHaveLength(1);
		expect(first.output + second.output).toBe('F');
	});

	it('lets a partial line out at once unless it could start a record', () => {
		const reader = new ReporterReader();
		expect(reader.push('..F').output).toBe('..F');
		expect(reader.push('mail me@').output).toBe('');
		expect(reader.flush().output).toBe('mail me@');
	});

	it('keeps lines that only look like records as output', () => {
		const text = `${M}not json\n${M}{"t": "unknown"}\n`;
		const { records, output } = readAll(text);
		expect(records).toEqual([]);
		expect(output).toBe(text);
	});

	it('reads a record without a trailing newline on flush', () => {
		const reader = new ReporterReader();
		reader.push(`${M}{"t": "done", "exitstatus": 1}`);
		expect(reader.flush().records).toEqual([{ t: 'done', exitstatus: 1 }]);
	});
});

describe('parseRecord', () => {
	it('parses items with their classes and lines', () => {
		expect(
			parseRecord(
				'{"t": "item", "nodeid": "t.py::A::test_x", "file": "C:\\\\p\\\\t.py", "line": 40, "classes": [{"nodeid": "t.py::A", "line": 38}]}',
			),
		).toEqual({
			t: 'item',
			nodeid: 't.py::A::test_x',
			file: 'C:\\p\\t.py',
			line: 40,
			classes: [{ nodeid: 't.py::A', line: 38 }],
		});
	});

	it('parses failures with the crash location', () => {
		const record = parseRecord(
			'{"t": "result", "nodeid": "t.py::test_bad", "outcome": "failed", "when": "call", "duration": 0.1, "message": "assert 1 == 2", "longrepr": "t.py:11: AssertionError", "crash": {"path": "C:\\\\p\\\\t.py", "line": 11}}',
		);
		expect(record).toMatchObject({
			outcome: 'failed',
			crash: { path: 'C:\\p\\t.py', line: 11 },
		});
	});

	it('rejects malformed records', () => {
		expect(parseRecord('{"t": "result", "nodeid": "x"}')).toBeNull();
		expect(parseRecord('[1, 2]')).toBeNull();
	});
});
