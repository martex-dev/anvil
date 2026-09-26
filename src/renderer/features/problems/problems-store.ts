import { create } from 'zustand';

import { onMonacoLoaded } from '../../lib/monaco/load';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { compareProblems } from './problems-model';

export interface Problem {
	path: string;
	line: number;
	column: number;
	message: string;
	severity: 'error' | 'warning' | 'info';
	source: string;
}

interface ProblemsState {
	items: Problem[];
	errors: number;
	warnings: number;
}

export const useProblems = create<ProblemsState>(() => ({ items: [], errors: 0, warnings: 0 }));

let started = false;

/**
 * Mirrors Monaco's markers (language servers, secret shield) into a store the Problems panel
 * and the status bar read. Starts lazily with Monaco itself.
 */
export function startProblemsTracking(): void {
	if (started) return;
	started = true;
	onMonacoLoaded((monaco) => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		const collect = (): void => {
			timer = null;
			const items: Problem[] = [];
			for (const m of monaco.editor.getModelMarkers({})) {
				const path = toWorkspacePath(m.resource);
				if (!path) continue;
				const severity =
					m.severity === monaco.MarkerSeverity.Error
						? 'error'
						: m.severity === monaco.MarkerSeverity.Warning
							? 'warning'
							: 'info';
				if (m.severity === monaco.MarkerSeverity.Hint) continue;
				items.push({
					path,
					line: m.startLineNumber,
					column: m.startColumn,
					message: m.message,
					severity,
					source: m.source ?? m.owner,
				});
			}
			items.sort(compareProblems);
			useProblems.setState({
				items,
				errors: items.filter((p) => p.severity === 'error').length,
				warnings: items.filter((p) => p.severity === 'warning').length,
			});
		};
		monaco.editor.onDidChangeMarkers(() => {
			// Language servers publish in bursts; one update per frame-ish is plenty.
			timer ??= setTimeout(collect, 120);
		});
		collect();
	});
}
