import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { type RefObject, useEffect, useState } from 'react';

import type { TerminalPresetId } from '@shared/ipc/channels/terminal';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { queryClient } from '../../lib/query-client';
import { requestOpenFile } from '../../stores/workbench-store';
import { useClipboardHistory } from '../editor/extras/clipboard';
import { findFileLinks } from './file-links';
import { buildXtermTheme } from './xterm-theme';

import '@xterm/xterm/css/xterm.css';

export type TerminalStatus = 'starting' | 'running' | 'exited' | 'error';

interface Options {
	sessionId: string;
	preset: TerminalPresetId;
	fontSize: number;
	enabled: boolean;
	/** Typed into the shell when the session is first created (Run file, tasks). */
	initialCommand?: string | undefined;
	/** Keep keyboard focus where it is (a command sent in the background). */
	focus?: boolean;
}

/**
 * Mounts xterm into `hostRef` and binds it to a main-process PTY session. Output streams in via
 * `terminal:data` events; keystrokes go out via `terminal:write`.
 */
export function useXterm(
	hostRef: RefObject<HTMLDivElement | null>,
	{ sessionId, preset, fontSize, enabled, initialCommand, focus = true }: Options,
): { status: TerminalStatus; error: string | null } {
	const [status, setStatus] = useState<TerminalStatus>('starting');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host || !enabled) return;
		let disposed = false;
		let exited = false;

		const term = new Terminal({
			fontFamily:
				getComputedStyle(document.documentElement).getPropertyValue('--font-code').trim() ||
				"'JetBrains Mono', ui-monospace, monospace",
			fontSize,
			lineHeight: 1.2,
			cursorBlink: true,
			scrollback: 5000,
			allowProposedApi: true,
			// The glass pane behind the terminal shows through.
			allowTransparency: true,
			theme: buildXtermTheme(),
		});
		const fit = new FitAddon();
		term.loadAddon(fit);
		term.loadAddon(new Unicode11Addon());
		term.unicode.activeVersion = '11';
		term.loadAddon(
			new WebLinksAddon((_event, uri) => {
				call('app:openExternal', uri).catch((e: unknown) =>
					rlog.warn('terminal', 'open link failed', e),
				);
			}),
		);
		term.open(host);
		// Theme / accent switches recolor running terminals without restarting them.
		const recolor = (): void => {
			term.options.theme = buildXtermTheme();
			term.options.fontFamily = getComputedStyle(document.documentElement)
				.getPropertyValue('--font-code')
				.trim();
		};
		window.addEventListener('anvil:appearance', recolor);
		// Tracebacks and `file.py:12:5` references open the file at that line.
		const links = term.registerLinkProvider({
			provideLinks(y, callback) {
				const root = queryClient.getQueryData<{ root: string | null }>(['workspace'])?.root;
				const text = term.buffer.active.getLine(y - 1)?.translateToString(true) ?? '';
				if (!root || !text) return callback(undefined);
				callback(
					findFileLinks(text, root).map((l) => ({
						range: { start: { x: l.start + 1, y }, end: { x: l.end, y } },
						text: text.slice(l.start, l.end),
						decorations: { underline: true, pointerCursor: true },
						activate: () => {
							requestOpenFile({ path: l.path, line: l.line, column: l.column });
						},
					})),
				);
			},
		});
		try {
			// GPU rendering is much faster for heavy output; fall back to DOM if WebGL is unavailable.
			const webgl = new WebglAddon();
			webgl.onContextLoss(() => webgl.dispose());
			term.loadAddon(webgl);
		} catch (e) {
			rlog.warn('terminal', 'WebGL renderer unavailable, using DOM renderer', e);
		}

		// Ctrl+C copies when text is selected (otherwise it's SIGINT); Ctrl+V pastes natively.
		term.attachCustomKeyEventHandler((e) => {
			if (e.type !== 'keydown' || !e.ctrlKey || e.shiftKey || e.altKey) return true;
			if (e.key === 'c' && term.hasSelection()) {
				useClipboardHistory.getState().push(term.getSelection(), null);
				void navigator.clipboard.writeText(term.getSelection());
				term.clearSelection();
				return false;
			}
			return e.key !== 'v';
		});

		const unsubscribeData = window.anvil.on('terminal:data', (m) => {
			if (m.sessionId === sessionId) term.write(m.data);
		});
		const unsubscribeExit = window.anvil.on('terminal:exit', (m) => {
			if (m.sessionId !== sessionId) return;
			exited = true;
			setStatus('exited');
			term.write(
				`\r\n\x1b[2m[process exited with code ${m.exitCode} — press Enter to restart]\x1b[0m\r\n`,
			);
		});

		const input = term.onData((data) => {
			if (exited) {
				if (data === '\r') {
					exited = false;
					setStatus('running');
					void call('terminal:restart', { sessionId, cols: term.cols, rows: term.rows });
				}
				return;
			}
			call('terminal:write', { sessionId, data }).catch((e: unknown) =>
				rlog.warn('terminal', 'write failed', e),
			);
		});

		let resizeTimer: ReturnType<typeof setTimeout> | undefined;
		const observer = new ResizeObserver(() => {
			if (host.clientWidth === 0 || host.clientHeight === 0) return;
			fit.fit();
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				void call('terminal:resize', { sessionId, cols: term.cols, rows: term.rows }).catch(
					() => undefined,
				);
			}, 60);
		});
		observer.observe(host);
		if (host.clientWidth > 0) fit.fit();

		call('terminal:open', {
			sessionId,
			preset,
			cols: Math.max(term.cols, 2),
			rows: Math.max(term.rows, 2),
			...(initialCommand ? { initialCommand } : {}),
		})
			.then((res) => {
				if (disposed) return;
				if (res.backlog) term.write(res.backlog);
				setStatus(res.running ? 'running' : 'exited');
				exited = !res.running;
				if (focus) term.focus();
			})
			.catch((e: unknown) => {
				rlog.error('terminal', `open failed (${preset})`, e);
				if (!disposed) {
					setStatus('error');
					setError(e instanceof Error ? e.message : String(e));
				}
			});

		return () => {
			window.removeEventListener('anvil:appearance', recolor);
			links.dispose();
			disposed = true;
			clearTimeout(resizeTimer);
			observer.disconnect();
			input.dispose();
			unsubscribeData();
			unsubscribeExit();
			term.dispose();
		};
		// initialCommand/focus only matter for the first open of a session.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hostRef, sessionId, preset, fontSize, enabled]);

	return { status, error };
}
