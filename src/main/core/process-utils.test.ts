import { type ChildProcess, spawn } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import { killTree } from './process-utils';

const posix = process.platform !== 'win32';
const children: ChildProcess[] = [];

function start(script: string, detached: boolean): ChildProcess {
	const child = spawn('sh', ['-c', script], { detached, stdio: 'ignore' });
	children.push(child);
	return child;
}

function alive(target: number): boolean {
	try {
		process.kill(target, 0);
		return true;
	} catch {
		return false;
	}
}

afterEach(() => {
	for (const child of children.splice(0)) child.kill('SIGKILL');
});

describe.skipIf(!posix)('killTree (POSIX)', () => {
	it('kills a detached process together with its children', async () => {
		const child = start('sleep 30 & wait', true);
		const pid = child.pid ?? 0;
		await new Promise((r) => setTimeout(r, 100));
		await killTree(pid);
		expect(alive(-pid)).toBe(false);
	});

	it('still kills a process that is not a group leader', async () => {
		const child = start('exec sleep 30', false);
		const exited = new Promise((r) => child.once('exit', r));
		await killTree(child.pid ?? 0);
		await exited;
		expect(child.signalCode).toBe('SIGTERM');
	});

	it('escalates to SIGKILL when SIGTERM is ignored', async () => {
		const child = start("trap '' TERM; while :; do sleep 0.05; done", true);
		const pid = child.pid ?? 0;
		await new Promise((r) => setTimeout(r, 100));
		const exited = new Promise((r) => child.once('exit', r));
		await killTree(pid, 200);
		await exited;
		expect(child.signalCode).toBe('SIGKILL');
	});
});
