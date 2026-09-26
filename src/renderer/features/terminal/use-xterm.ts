import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { type RefObject, useEffect, useRef, useState } from 'react';

import type { TerminalPresetId } from '@shared/ipc/channels/terminal';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { queryClient } from '../../lib/query-client';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { useClipboardHistory } from '../editor/extras/clipboard';
import { findFileLinks } from './file-links';
import { FOCUS_TERMINAL_EVENT, markAttached, unmarkAttached } from './terminal-store';
import { terminalKeyAction } from './xterm-keys';
import { buildXtermTheme } from './xterm-theme';

import '@xterm/xterm/css/xterm.css';

/** The code font setting, with a monospace fallback so xterm never gets a proportional font. */
function codeFont(): string {
	return (
		getComputedStyle(document.documentElement).getPropertyValue('--font-code').trim() ||
		"'JetBrains Mono', ui-monospace, monospace"
	);
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The Reduce motion setting (on <html>) or the OS preference: then the cursor doesn't blink. */
function reducedMotion(): boolean {
	return (
		document.documentElement.dataset['reduceMotion'] === 'true' ||
		window.matchMedia(REDUCED_MOTION_QUERY).matches
	);
}

export type TerminalStatus = 'starting' | 'running' | 'exited' | 'error';

interface Options {
	sessionId: string;
	preset: TerminalPresetId;
	fontSize: number;
	/** Whether the session may start; ignored once it has opened. */
	enabled: boolean;
	/** Typed into the shell when the session is first created (Run file, tasks). */
	initialCommand?: string | undefined;
	/** Keep keyboard focus where it is (a command sent in the background). */
	focus?: boolean;
	/** Main's name for the session once it is open ('IPython' or 'Python REPL' for the REPL). */
	onOpen?: (info: { title: string }) => void;
}

/**
 * Mounts xterm into `hostRef` and binds it to a main-process PTY session. Output streams in via
 * `terminal:data` events; keystrokes go out via `terminal:write`.
 */
export function useXterm(
	hostRef: RefObject<HTMLDivElement | null>,
	{ sessionId, preset, fontSize, enabled, initialCommand, focus = true, onOpen }: Options,
): { status: TerminalStatus; error: string | null; retry: () => void } {
	const [status, setStatus] = useState<TerminalStatus>('starting');
	const [error, setError] = useState<string | null>(null);
	// Bumped by retry(): re-runs the effect so a failed start can be attempted again.
	const [attempt, setAttempt] = useState(0);
	// `enabled` only gates the start: an opened session stays attached even if a later presets
	// refetch fails or reports the profile unavailable (disposing would blank a live shell).
	const attach = enabled || status !== 'starting';
	// The live terminal, for settings applied without re-creating it (font size).
	const viewRef = useRef<{ term: Terminal; refit: () => void } | null>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host || !attach) return;
		let disposed = false;
		let exited = false;
		// Counts exits so a restart that resolves after its new process already died stays exited.
		let exits = 0;
		let restarting = false;

		const term = new Terminal({
			fontFamily: codeFont(),
			fontSize,
			lineHeight: 1.2,
			cursorBlink: !reducedMotion(),
			scrollback: 5000,
			allowProposedApi: true,
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
		let resizeTimer: ReturnType<typeof setTimeout> | undefined;
		// Fits xterm to its host and tells the pty the new size (debounced while dragging).
		const refit = (): void => {
			if (host.clientWidth === 0 || host.clientHeight === 0) return;
			fit.fit();
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				call('terminal:resize', { sessionId, cols: term.cols, rows: term.rows }).catch(
					(e: unknown) => rlog.warn('terminal', 'resize failed', e),
				);
			}, 60);
		};
		viewRef.current = { term, refit };
		// Theme / accent switches recolor running terminals without restarting them.
		const recolor = (): void => {
			term.options.theme = buildXtermTheme();
			term.options.fontFamily = codeFont();
			term.options.cursorBlink = !reducedMotion();
			// A new font changes the cell size: refit so cols/rows (and the pty) match again.
			refit();
		};
		window.addEventListener('anvil:appearance', recolor);
		const motion = window.matchMedia(REDUCED_MOTION_QUERY);
		const updateBlink = (): void => {
			term.options.cursorBlink = !reducedMotion();
		};
		motion.addEventListener('change', updateBlink);
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

		term.attachCustomKeyEventHandler((e) => {
			const action = terminalKeyAction(e, term.hasSelection());
			if (action === 'copy') {
				const text = term.getSelection();
				useClipboardHistory.getState().push(text, null);
				navigator.clipboard.writeText(text).catch((err: unknown) => {
					rlog.warn('terminal', 'copy failed', err);
					toast.error('Copy failed', err instanceof Error ? err.message : undefined);
				});
				term.clearSelection();
			}
			// false: xterm ignores the key (copied, or the browser pastes natively).
			return action === 'xterm';
		});

		const unsubscribeData = window.anvil.on('terminal:data', (m) => {
			if (m.sessionId !== sessionId) return;
			// Output after an exit means main restarted the session (a Run or task command).
			if (exited) {
				exited = false;
				setStatus('running');
			}
			term.write(m.data);
		});
		const unsubscribeExit = window.anvil.on('terminal:exit', (m) => {
			if (m.sessionId !== sessionId) return;
			exited = true;
			exits++;
			setStatus('exited');
			term.write(
				`\r\n\x1b[2m[process exited with code ${m.exitCode} — press Enter to restart]\x1b[0m\r\n`,
			);
		});

		const restart = (): void => {
			restarting = true;
			const before = exits;
			call('terminal:restart', { sessionId, preset, cols: term.cols, rows: term.rows }).then(
				() => {
					restarting = false;
					if (disposed || exits !== before) return;
					exited = false;
					setStatus('running');
				},
				(e: unknown) => {
					restarting = false;
					rlog.error('terminal', `restart failed (${preset})`, e);
					if (disposed) return;
					const reason = e instanceof Error ? e.message : String(e);
					term.write(
						`\r\n\x1b[31m[restart failed: ${reason} — press Enter to try again]\x1b[0m\r\n`,
					);
				},
			);
		};

		const input = term.onData((data) => {
			if (exited) {
				if (data === '\r' && !restarting) restart();
				return;
			}
			call('terminal:write', { sessionId, data }).catch((e: unknown) =>
				rlog.warn('terminal', 'write failed', e),
			);
		});

		const observer = new ResizeObserver(refit);
		observer.observe(host);
		if (host.clientWidth > 0) fit.fit();

		markAttached(sessionId);
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
				onOpen?.({ title: res.title });
			})
			.catch((e: unknown) => {
				rlog.error('terminal', `open failed (${preset})`, e);
				if (!disposed) {
					setStatus('error');
					setError(e instanceof Error ? e.message : String(e));
				}
			});

		const focusRequested = (e: Event): void => {
			if (e instanceof CustomEvent && e.detail === sessionId) term.focus();
		};
		window.addEventListener(FOCUS_TERMINAL_EVENT, focusRequested);

		return () => {
			viewRef.current = null;
			unmarkAttached(sessionId);
			window.removeEventListener(FOCUS_TERMINAL_EVENT, focusRequested);
			window.removeEventListener('anvil:appearance', recolor);
			motion.removeEventListener('change', updateBlink);
			links.dispose();
			disposed = true;
			clearTimeout(resizeTimer);
			observer.disconnect();
			input.dispose();
			unsubscribeData();
			unsubscribeExit();
			term.dispose();
		};
		// initialCommand/focus/onOpen only matter for the first open of a session; fontSize is
		// applied in place below (re-creating xterm would lose scrollback and garble TUIs).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hostRef, sessionId, preset, attach, attempt]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view || view.term.options.fontSize === fontSize) return;
		view.term.options.fontSize = fontSize;
		view.refit();
	}, [fontSize]);

	const retry = (): void => {
		setError(null);
		setStatus('starting');
		setAttempt((n) => n + 1);
	};

	return { status, error, retry };
}
