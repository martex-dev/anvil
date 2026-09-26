import type * as Monaco from 'monaco-editor';

import { isEnvFile, scanText } from '@shared/secret-scan';

import { getSettings, watchSetting } from '../../../app/hooks/use-settings';
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

interface Secret {
	line: number;
	/** 1-based columns, end exclusive. */
	start: number;
	end: number;
	/** A .env value (hover explains the blur) rather than a key found in code. */
	env: boolean;
}

/**
 * The secrets to blur: all but those on lines a cursor or selection touches, so the line being
 * edited (or reached with the keyboard) reads in clear.
 */
export function hiddenSecrets<T extends { line: number }>(
	secrets: readonly T[],
	selections: ReadonlyArray<{ startLineNumber: number; endLineNumber: number }>,
): T[] {
	return secrets.filter(
		(s) =>
			!selections.some((sel) => s.line >= sel.startLineNumber && s.line <= sel.endLineNumber),
	);
}

/**
 * Secret shield: blurs values in .env files (hover, or move the cursor to the line, to peek)
 * and flags API keys, private keys, keypairs and seed phrases in code, as problems in the
 * Problems panel. Nothing leaves the renderer; the scan is local regexes.
 */
export function attachShield(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	watchShieldSetting();
	const blur = editor.createDecorationsCollection();
	let timer: ReturnType<typeof setTimeout> | null = null;
	/** What the last scan found; the cursor's lines are left out when blurring. */
	let secrets: Secret[] = [];
	/** The text changed since the scan: its ranges are out of date until the next paint. */
	let stale = false;
	/**
	 * The user put the cursor somewhere (keyboard or mouse) in the focused editor. Opening a
	 * file or restoring its position doesn't count: a .env must open fully blurred, even
	 * though the cursor starts on a value.
	 */
	let peeking = false;

	const applyBlur = (): void => {
		if (stale) return;
		blur.set(
			hiddenSecrets(secrets, peeking ? (editor.getSelections() ?? []) : []).map((r) => ({
				range: new monaco.Range(r.line, r.start, r.line, r.end),
				options: {
					inlineClassName: 'anvil-secret-blur',
					...(r.env
						? {
								hoverMessage: {
									value: 'Secret shield: value hidden. Hover or move the cursor to the line to reveal.',
								},
							}
						: {}),
				},
			})),
		);
	};

	const onSelection = (e: Monaco.editor.ICursorSelectionChangedEvent): void => {
		peeking = e.source === 'keyboard' || e.source === 'mouse';
		applyBlur();
	};
	const hide = (): void => {
		peeking = false;
		applyBlur();
	};

	const paint = (): void => {
		stale = false;
		secrets = [];
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
		if (isEnvFile(path)) {
			for (const r of envValueRanges(model.getLinesContent()))
				secrets.push({ ...r, env: true });
		}
		const text = model.getValueLength() <= MAX_SCAN ? model.getValue() : '';
		const findings = scanText(text);
		for (const f of findings) {
			secrets.push({ line: f.line, start: f.column, end: f.column + f.length, env: false });
		}
		applyBlur();
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
		stale = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(paint, 400);
	};
	const subs = [
		editor.onDidChangeModel(() => {
			peeking = false;
			paint();
		}),
		editor.onDidChangeModelContent(schedule),
		// Keyboard users can't hover: the line they move the cursor to shows its value in clear.
		editor.onDidChangeCursorSelection(onSelection),
		editor.onDidBlurEditorText(hide),
	];
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

let watching = false;

/**
 * Repaints every attached editor as soon as the setting flips, however it was toggled (status
 * bar, Settings, the command, or another window), so the blur never lags the switch.
 */
function watchShieldSetting(): void {
	if (watching) return;
	watching = true;
	watchSetting('secretShield', () => window.dispatchEvent(new CustomEvent('anvil:shield')));
}
