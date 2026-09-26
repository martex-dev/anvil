import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';
import { openDefinition } from './open-definition';
import { setMonacoWorkspaceRoot } from './workspace-root';

const requestOpenFile = vi.fn((_request: unknown) => true);
vi.mock('../../stores/workbench-store', () => ({
	requestOpenFile: (request: unknown) => requestOpenFile(request),
}));

const fileUri = (fsPath: string): { scheme: string; fsPath: string } => ({
	scheme: 'file',
	fsPath,
});

describe('openDefinition', () => {
	beforeEach(() => {
		setMonacoWorkspaceRoot('C:/proj');
		requestOpenFile.mockClear();
		useToastStore.setState({ toasts: [] });
	});

	it('opens a file inside the folder at the definition', () => {
		openDefinition({
			uri: fileUri('C:\\proj\\src\\a.py'),
			selection: { startLineNumber: 4, startColumn: 2 },
		});
		expect(requestOpenFile).toHaveBeenCalledWith({
			path: 'src/a.py',
			line: 4,
			column: 2,
			remember: false,
		});
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it('explains why a definition outside the folder does not open', () => {
		const outside = 'C:\\Python312\\Lib\\site-packages\\pandas\\core\\frame.py';
		openDefinition({ uri: fileUri(outside) });
		expect(requestOpenFile).not.toHaveBeenCalled();
		expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
			title: 'Definition is outside the open folder',
			description: outside,
			tone: 'info',
		});
	});
});
