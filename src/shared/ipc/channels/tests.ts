import { z } from 'zod';

import { defineChannels } from '../define';

export const TestOutcomeSchema = z.enum(['passed', 'failed', 'skipped', 'error']);
export type TestOutcome = z.infer<typeof TestOutcomeSchema>;

export const TestNodeKindSchema = z.enum(['file', 'class', 'function', 'case']);
export type TestNodeKind = z.infer<typeof TestNodeKindSchema>;

/** One node of the discovered tree: file → class → function → parametrized case. */
export interface TestNode {
	/** pytest node id (`tests/test_a.py::TestX::test_y[1]`); a file's id is its path part. */
	id: string;
	kind: TestNodeKind;
	/** What the tree shows: the relative path, class name, function name or `[params]`. */
	label: string;
	/** Absolute path of the file the node lives in. */
	file: string;
	/** 1-based line of the `def`/`class`, or null when pytest couldn't tell (files, generated tests). */
	line: number | null;
	children: TestNode[];
}

export const TestNodeSchema: z.ZodType<TestNode> = z.lazy(() =>
	z.object({
		id: z.string(),
		kind: TestNodeKindSchema,
		label: z.string(),
		file: z.string(),
		line: z.number().int().min(1).nullable(),
		children: z.array(TestNodeSchema),
	}),
);

export const TestLocationSchema = z.object({
	path: z.string(),
	line: z.number().int().min(1),
});
export type TestLocation = z.infer<typeof TestLocationSchema>;

export const TestResultSchema = z.object({
	/** pytest's node id of a single test (a function or one parametrized case). */
	id: z.string(),
	outcome: TestOutcomeSchema,
	/** Seconds, summed over setup, call and teardown. */
	duration: z.number().min(0),
	/** One line: the assertion or exception message, or a skip reason. */
	message: z.string().nullable(),
	/** The full failure report as pytest prints it; tracebacks carry `path:line` references. */
	traceback: z.string().nullable(),
	/** Where the failure was raised, when pytest knows. */
	crash: TestLocationSchema.nullable(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

export const CollectErrorSchema = z.object({
	/** The file or package that failed to import. */
	id: z.string(),
	message: z.string(),
});
export type CollectError = z.infer<typeof CollectErrorSchema>;

export const TestDiscoverySchema = z.discriminatedUnion('status', [
	z.object({
		status: z.literal('ok'),
		tree: z.array(TestNodeSchema),
		/** Files that failed to import; their tests are missing from `tree`. */
		errors: z.array(CollectErrorSchema),
		/** Interpreter pytest ran with, so the view can say which env it used. */
		python: z.string(),
	}),
	/** No folder open, no Python found, or pytest isn't installed in the selected interpreter. */
	z.object({
		status: z.enum(['noFolder', 'noPython', 'noPytest']),
		python: z.string().nullable(),
	}),
	/** pytest itself failed (bad config, usage error); `output` is what it printed. */
	z.object({ status: z.literal('failed'), message: z.string(), output: z.string() }),
]);
export type TestDiscovery = z.infer<typeof TestDiscoverySchema>;

/** A test id sent back from the renderer. Main only runs ids its last discovery produced. */
const TestIdSchema = z
	.string()
	.min(1)
	.max(4096)
	.refine((id) => !/[\0\r\n]/.test(id), 'Invalid test id');

export const testsChannels = defineChannels({
	/** Collects tests with the selected interpreter's pytest (`--collect-only`). */
	'tests:discover': { input: z.void(), output: TestDiscoverySchema },
	/**
	 * Starts a run. `ids` are node ids from the last discovery (any level), `files` are workspace
	 * files to run whole; both empty runs everything. Results stream as `tests:event`.
	 */
	'tests:run': {
		input: z.object({
			ids: z.array(TestIdSchema).max(5000).default([]),
			files: z.array(z.string().min(1).max(4096)).max(500).default([]),
		}),
		output: z.object({ runId: z.number().int() }),
	},
	/** Stops the current run (kills pytest and its children). No-op when idle. */
	'tests:cancel': { input: z.void(), output: z.void() },
	/** The full console output of the last run, for reading failures at length. */
	'tests:output': { input: z.void(), output: z.object({ text: z.string() }) },
	/**
	 * A shell command that runs the given tests under pdb (`--pdb`) with the selected interpreter,
	 * for Debug Test in a terminal. Same id rules as `tests:run`.
	 */
	'tests:debugCommand': {
		input: z.object({ ids: z.array(TestIdSchema).min(1).max(100) }),
		output: z.object({ command: z.string() }),
	},
});

export const TestRunEventSchema = z.discriminatedUnion('type', [
	/** The run began; `ids` are the tests it is expected to run, from the last discovery. */
	z.object({ type: z.literal('started'), runId: z.number().int(), ids: z.array(z.string()) }),
	/** pytest collected what it will really run; replaces the expected set. */
	z.object({ type: z.literal('queued'), runId: z.number().int(), ids: z.array(z.string()) }),
	/** A file failed to import during the run; its tests can't run. */
	z.object({
		type: z.literal('collectError'),
		runId: z.number().int(),
		id: z.string(),
		message: z.string(),
	}),
	/** One test started (drives the spinner). */
	z.object({ type: z.literal('running'), runId: z.number().int(), id: z.string() }),
	z.object({ type: z.literal('result'), runId: z.number().int(), result: TestResultSchema }),
	/** Console output chunk (reporter lines stripped). */
	z.object({ type: z.literal('output'), runId: z.number().int(), text: z.string() }),
	z.object({
		type: z.literal('finished'),
		runId: z.number().int(),
		/** pytest's exit code; null when it was cancelled or couldn't start. */
		exitCode: z.number().int().nullable(),
		cancelled: z.boolean(),
		/** Set when pytest never got to run tests (missing, crashed on config). */
		error: z.string().nullable(),
	}),
]);
export type TestRunEvent = z.infer<typeof TestRunEventSchema>;

export const testsEvents = {
	'tests:event': TestRunEventSchema,
};
