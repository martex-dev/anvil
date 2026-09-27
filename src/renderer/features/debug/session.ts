import type { DebugTarget } from '@shared/ipc/channels/debug';

import { getSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { saveDirtyFiles } from '../python/save-before-run';
import { runInTerminal } from '../terminal/terminal-store';
import { configureBreakpoints, resetBreakpointSync } from './breakpoint-sync';
import { breakpointsRoot } from './breakpoints';
import { DapClient } from './dap-client';
import { type DapMessage, str, toCapabilities, toStackFrames } from './dap-types';
import { debugState, dispatch } from './debug-store';
import { offerDebugpyInstall } from './install-debugpy';
import { relativePath } from './paths';

/** The live conversation with the adapter; null when nothing is being debugged. */
let client: DapClient | null = null;
let lastTarget: DebugTarget | null = null;
/** Set by Restart: once the old session has ended, the same target starts again. */
let restartPending = false;
/** The folder as the adapter spells it (8.3 names and links resolved), from debug:start. */
let adapterRoot: string | null = null;

/** A path from the adapter (a stack frame) as a workspace path, or null outside the folder. */
export function workspacePathOf(abs: string): string | null {
	const root = breakpointsRoot();
	return (
		(root ? relativePath(root, abs) : null) ??
		(adapterRoot ? relativePath(adapterRoot, abs) : null)
	);
}

export function currentClient(): DapClient | null {
	return client;
}

export function labelOf(target: DebugTarget): string {
	switch (target.kind) {
		case 'file':
			return target.path.split('/').at(-1) ?? target.path;
		case 'module':
			return `-m ${target.module}`;
		case 'pytest':
			return target.test.split('::').at(-1) ?? target.test;
	}
}

const errorText = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/** Starts debugging a target, ending any session that is still running first. */
export async function startDebugging(target: DebugTarget): Promise<void> {
	if (debugState().status !== 'idle') await stopDebugging();
	// debugpy runs what is on disk: save first so the paused line matches the editor.
	if (!(await saveDirtyFiles())) return;
	lastTarget = target;
	dispatch({ type: 'starting', label: labelOf(target) });
	useLayoutStore.getState().showView('debug');
	let started;
	try {
		started = await call('debug:start', { target, justMyCode: getSettings().debugJustMyCode });
	} catch (error) {
		dispatch({ type: 'ended', error: errorText(error) });
		toast.error('Could not start debugging', errorText(error));
		return;
	}
	if (started.status === 'missing') {
		const install = { env: started.env, command: started.installCommand };
		dispatch({ type: 'ended', error: `debugpy is not installed in ${started.env}`, install });
		offerDebugpyInstall(install);
		return;
	}
	const session = started.session;
	adapterRoot = started.root;
	const dap = new DapClient(
		(message) => call('debug:send', { session, message }),
		(event, body) => onEvent(dap, event, body),
	);
	client = dap;
	resetBreakpointSync();
	dispatch({ type: 'started', session });
	try {
		const caps = await dap.request('initialize', {
			clientID: 'anvil',
			clientName: 'Anvil',
			adapterID: 'debugpy',
			pathFormat: 'path',
			linesStartAt1: true,
			columnsStartAt1: true,
			supportsVariableType: true,
			supportsRunInTerminalRequest: true,
		});
		dispatch({ type: 'capabilities', capabilities: toCapabilities(caps) });
		// debugpy answers launch only after configurationDone, which follows 'initialized'.
		await dap.request('launch', {});
	} catch (error) {
		if (client !== dap) return;
		rlog.warn('debug', 'launch failed', error);
		toast.error('Debugging failed to start', errorText(error));
		await stopDebugging();
	}
}

async function configure(dap: DapClient): Promise<void> {
	try {
		await configureBreakpoints(dap);
		const filters = (debugState().capabilities.exceptionBreakpointFilters ?? [])
			.filter((f) => f.default)
			.map((f) => f.filter);
		await dap.request('setExceptionBreakpoints', { filters });
		await dap.request('configurationDone');
	} catch (error) {
		rlog.warn('debug', 'configuring the session failed', error);
		dispatch({ type: 'console', kind: 'error', text: errorText(error) });
	}
}

/** Shows where the program stopped: the call stack, then the top frame in the editor. */
async function onStopped(dap: DapClient, threadId: number, reason: string): Promise<void> {
	try {
		const body = await dap.request('stackTrace', { threadId, startFrame: 0, levels: 200 });
		dispatch({ type: 'frames', threadId, frames: toStackFrames(body['stackFrames']) });
		const top = debugState().frames[0];
		if (top) revealFrame(top.id, true);
		if (reason === 'exception' && debugState().capabilities.supportsExceptionInfoRequest) {
			const info = await dap.request('exceptionInfo', { threadId });
			const text = [str(info['exceptionId']), str(info['description'])]
				.filter(Boolean)
				.join(': ');
			if (text) dispatch({ type: 'stopDetail', text });
		}
	} catch (error) {
		rlog.warn('debug', 'reading the stack failed', error);
	}
}

function onEvent(dap: DapClient, event: string, body: Record<string, unknown>): void {
	if (client !== dap) return;
	dispatch({ type: 'event', event, body });
	if (event === 'initialized') void configure(dap);
	if (event === 'stopped') {
		const state = debugState();
		if (state.threadId !== null) void onStopped(dap, state.threadId, state.stopReason ?? '');
	}
	// The program ended: the adapter has nothing left to do, so end it too.
	if (event === 'terminated') void stopDebugging();
}

/** A message main relayed from the adapter. */
export function receiveDebugMessage(session: string, message: DapMessage): void {
	if (client && debugState().session === session) client.receive(message);
}

/** The adapter asked to start the program in a terminal (main already built the command). */
export async function receiveRunInTerminal(
	session: string,
	seq: number,
	command: string,
): Promise<void> {
	const dap = client;
	if (!dap || debugState().session !== session) return;
	try {
		await runInTerminal({ role: 'debug', preset: 'powershell', title: 'debug', command });
		await dap.respond(seq, 'runInTerminal');
	} catch (error) {
		await dap.respond(seq, 'runInTerminal', errorText(error)).catch(() => undefined);
	}
}

/** Main reports the adapter process is gone (after Stop, or a crash). */
export function receiveDebugExit(session: string, code: number | null, stderr: string): void {
	const state = debugState();
	if (state.session !== session) return;
	client?.close();
	client = null;
	resetBreakpointSync();
	const crashed = state.status !== 'stopping' && code !== 0;
	const detail = stderr.split(/\r?\n/).slice(-6).join('\n');
	if (crashed) {
		rlog.warn('debug', `debug adapter exited with ${String(code)}`, stderr);
		toast.error('The debugger stopped unexpectedly', detail || `Exit code ${String(code)}`);
	}
	dispatch({ type: 'ended', error: crashed ? detail || `Exit code ${String(code)}` : undefined });
	if (restartPending && lastTarget) {
		restartPending = false;
		void startDebugging(lastTarget);
	}
}

/** Ends the session: the program (via disconnect) and the adapter. */
export async function stopDebugging(): Promise<void> {
	const { session, status } = debugState();
	if (status === 'idle') return;
	dispatch({ type: 'stopping' });
	if (!session) {
		dispatch({ type: 'ended' });
		return;
	}
	try {
		await call('debug:stop', { session });
	} catch (error) {
		rlog.warn('debug', 'debug:stop failed', error);
	}
	// Main reports the adapter's exit (receiveDebugExit). If it was already gone there is no such
	// report, so don't leave the views waiting in 'stopping'.
	setTimeout(() => {
		if (debugState().session === session) receiveDebugExit(session, 0, '');
	}, 2_000);
}

export async function restartDebugging(): Promise<void> {
	if (!lastTarget) return;
	if (debugState().status === 'idle') return startDebugging(lastTarget);
	restartPending = true;
	await stopDebugging();
}

/** Continue / step: the program runs again, so its views clear until the next stop. */
export async function control(
	command: 'continue' | 'next' | 'stepIn' | 'stepOut' | 'pause',
): Promise<void> {
	const { status, threadId, generation } = debugState();
	const dap = client;
	if (!dap) return;
	if (command === 'pause' ? status !== 'running' : status !== 'paused') return;
	try {
		await dap.request(command, { threadId: threadId ?? 1 });
		// debugpy doesn't send 'continued' for a step; the answered request means it runs again,
		// unless a quick step already stopped again (a newer generation).
		const now = debugState();
		if (command !== 'pause' && now.status === 'paused' && now.generation === generation)
			dispatch({ type: 'event', event: 'continued', body: {} });
	} catch (error) {
		toast.error(`Debugger: ${command} failed`, errorText(error));
	}
}

/** Selects a frame of the call stack and shows its line (files outside the folder can't open). */
export function revealFrame(frameId: number, fromStop = false): void {
	dispatch({ type: 'selectFrame', frameId });
	const frame = debugState().frames.find((f) => f.id === frameId);
	const path = frame?.source?.path ? workspacePathOf(frame.source.path) : null;
	if (!frame || !path) {
		if (!fromStop) toast.info('That frame is outside the open folder');
		return;
	}
	requestOpenFile({ path, line: frame.line, column: Math.max(frame.column, 1), focus: true });
}

export function lastDebugTarget(): DebugTarget | null {
	return lastTarget;
}
