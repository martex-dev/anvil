import type * as Monaco from 'monaco-editor';

import { isEnvFile, scanText } from '@shared/secret-scan';

import { getSettings } from '../../../app/hooks/use-settings';
import type { MonacoApi } from '../../../lib/monaco/setup';
import { toWorkspacePath } from '../../../lib/monaco/workspace-root';

const OWNER = 'anvil-shield';
const MAX_SCAN = 2 * 1024 * 1024;

/**
 * 0-based offset just past a dotenv value that begins at `from`. A quoted value runs to its
 * closing quote, `#` included (`"abc #123"` is all secret); only an unquoted value can have a
 * trailing ` # comment`. An unclosed quote hides the rest of the line.
 */
function valueEnd(text: string, from: number): number {
	const quote = text[from];
	if (quote === '"' || quote === "'") {
		for (let i = from + 1; i < text.length; i++) {
			// Double quotes allow backslash escapes (`\"`); single quotes are literal.
			if (quote === '"' && text[i] === '\\') i++;
			else if (text[i] === quote) return i + 1;
		}
		return text.trimEnd().length;
	}
	return text.replace(/\s+#.*$/, '').trimEnd().length;
}

/** `KEY=value` lines of a dotenv file: the value's column range, 1-based. */
export function envValueRanges(
	lines: readonly string[],
): Array<{ line: number; start: number; end: number }> {
	const out: Array<{ line: number; start: number; end: number }> = [];
	lines.forEach((text, i) => {
		const m = /^\s*(?:export\s+)?[A-Za-z_][\w.-]*\s*=\s*/.exec(text);
		if (!m || text.trimStart().startsWith('#')) return;
		const start = m[0].length + 1;
		const end = valueEnd(text, m[0].length) + 1;
		if (end > start) out.push({ line: i + 1, start, end });
	});
	return out;
}

/**
 * Secret shield: blurs values in .env files (hover to peek) and flags API keys, private keys,
 * keypairs and seed phrases in code, as problems in the Problems panel. Nothing leaves the
 * renderer; the scan is local regexes.
 */
export function attachShield(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	const blur = editor.createDecorationsCollection();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const paint = (): void => {
		const model = editor.getModel();
		if (!model) return blur.clear();
		if (!getSettings().secretShield) {
			blur.clear();
			// Files in background tabs were flagged too; their problems must go with the shield.
			for (const m of monaco.editor.getModels()) {
				if (monaco.editor.getModelMarkers({ owner: OWNER, resource: m.uri }).length > 0)
					monaco.editor.setModelMarkers(m, OWNER, []);
			}
			return;
		}
		const path = toWorkspacePath(model.uri) ?? model.uri.path;
		const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
		if (isEnvFile(path)) {
			for (const r of envValueRanges(model.getLinesContent())) {
				decorations.push({
					range: new monaco.Range(r.line, r.start, r.line, r.end),
					options: {
						inlineClassName: 'anvil-secret-blur',
						hoverMessage: { value: 'Secret shield: value hidden. Hover to reveal.' },
					},
				});
			}
		}
		const text = model.getValueLength() <= MAX_SCAN ? model.getValue() : '';
		const findings = scanText(text);
		for (const f of findings) {
			decorations.push({
				range: new monaco.Range(f.line, f.column, f.line, f.column + f.length),
				options: { inlineClassName: 'anvil-secret-blur' },
			});
		}
		blur.set(decorations);
		monaco.editor.setModelMarkers(
			model,
			OWNER,
			findings.map((f) => ({
				severity:
					f.severity === 'high'
						? monaco.MarkerSeverity.Error
						: monaco.MarkerSeverity.Warning,
				message: `${f.kind} in source (${f.preview}). Load it from an environment variable or Settings instead of hardcoding it.`,
				source: 'secret shield',
				startLineNumber: f.line,
				startColumn: f.column,
				endLineNumber: f.line,
				endColumn: f.column + f.length,
			})),
		);
	};
	const schedule = (): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(paint, 400);
	};
	const subs = [editor.onDidChangeModel(paint), editor.onDidChangeModelContent(schedule)];
	window.addEventListener('anvil:shield', paint);
	paint();
	return {
		dispose() {
			window.removeEventListener('anvil:shield', paint);
			if (timer) clearTimeout(timer);
			for (const s of subs) s.dispose();
			blur.clear();
		},
	};
}

export function repaintShield(): void {
	// Settings toggled: every attached editor repaints right away.
	window.dispatchEvent(new CustomEvent('anvil:shield'));
}
