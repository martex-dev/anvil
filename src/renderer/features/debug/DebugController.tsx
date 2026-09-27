import { useEffect } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { rlog } from '../../lib/log';
import { onMonacoLoaded } from '../../lib/monaco/load';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { setBreakpointsRoot } from './breakpoints';
import { registerDebugHover } from './evaluate';
import { receiveDebugExit, receiveDebugMessage, receiveRunInTerminal } from './session';

/**
 * Headless (mounted once by the shell): routes the adapter's messages to the session, loads the
 * open folder's breakpoints and adds hover evaluation to Python editors.
 */
export function DebugController(): null {
	const root = useWorkspace().info.root;
	// Each folder has its own breakpoints (they hold workspace-relative paths).
	useEffect(() => setBreakpointsRoot(root), [root]);

	useAnvilEvent('debug:message', ({ session, message }) => receiveDebugMessage(session, message));
	useAnvilEvent('debug:runInTerminal', ({ session, seq, command }) => {
		void receiveRunInTerminal(session, seq, command);
	});
	useAnvilEvent('debug:exit', ({ session, code, stderr }) =>
		receiveDebugExit(session, code, stderr),
	);

	useEffect(() => {
		let hover: { dispose(): void } | null = null;
		const off = onMonacoLoaded((monaco) => {
			try {
				hover = registerDebugHover(monaco);
			} catch (error) {
				rlog.error('debug', 'registering the debug hover failed', error);
			}
		});
		return () => {
			off();
			hover?.dispose();
		};
	}, []);
	return null;
}
