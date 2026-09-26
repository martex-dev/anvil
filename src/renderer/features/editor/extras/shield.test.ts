import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../app/hooks/use-settings', () => ({ getSettings: () => ({ secretShield: true }) }));

const { envValueRanges } = await import('./shield');

/** The blurred text of each line. */
const blurred = (lines: string[]): string[] =>
	envValueRanges(lines).map((r) => (lines[r.line - 1] ?? '').slice(r.start - 1, r.end - 1));

describe('envValueRanges', () => {
	it('hides an unquoted value but not its trailing comment', () => {
		expect(blurred(['API_KEY=abc123  # prod key'])).toEqual(['abc123']);
	});

	it('hides a quoted value up to its closing quote, # included', () => {
		expect(blurred(['PASSWORD="abc #123xyz"  # note', "TOKEN='x #y'"])).toEqual([
			'"abc #123xyz"',
			"'x #y'",
		]);
		expect(blurred(['A="say \\"hi\\" #1"'])).toEqual(['"say \\"hi\\" #1"']);
	});

	it('hides the rest of the line when a quote is never closed', () => {
		expect(blurred(['KEY="abc #123   '])).toEqual(['"abc #123']);
	});

	it('skips comments and empty values', () => {
		expect(blurred(['# KEY=value', 'EMPTY=', 'export NAME=x'])).toEqual(['x']);
	});
});
