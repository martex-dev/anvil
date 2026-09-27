/**
 * The slice of the Debug Adapter Protocol Anvil uses. Messages arrive as untyped JSON relayed by
 * main, so every reader goes through the small guards here instead of trusting the shapes.
 */

export type DapMessage = Record<string, unknown>;

export interface DapSource {
	path?: string;
	name?: string;
}

export interface StackFrame {
	id: number;
	name: string;
	line: number;
	column: number;
	source?: DapSource;
}

export interface Scope {
	name: string;
	variablesReference: number;
	expensive: boolean;
}

export interface Variable {
	name: string;
	value: string;
	type?: string;
	variablesReference: number;
	evaluateName?: string;
}

export interface EvaluateResult {
	result: string;
	type?: string;
	variablesReference: number;
}

export interface ExceptionFilter {
	filter: string;
	label: string;
	default?: boolean;
}

export interface Capabilities {
	supportsConditionalBreakpoints?: boolean;
	supportsHitConditionalBreakpoints?: boolean;
	supportsLogPoints?: boolean;
	supportsEvaluateForHovers?: boolean;
	supportsExceptionInfoRequest?: boolean;
	supportsSetVariable?: boolean;
	exceptionBreakpointFilters?: ExceptionFilter[];
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const str = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined;

export const num = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** A DAP message's body, or an empty object. */
export function bodyOf(message: DapMessage): Record<string, unknown> {
	return isRecord(message['body']) ? message['body'] : {};
}

export function toStackFrames(value: unknown): StackFrame[] {
	if (!Array.isArray(value)) return [];
	const out: StackFrame[] = [];
	for (const raw of value) {
		if (!isRecord(raw)) continue;
		const id = num(raw['id']);
		if (id === undefined) continue;
		const source = isRecord(raw['source']) ? raw['source'] : undefined;
		const path = str(source?.['path']);
		const name = str(source?.['name']);
		out.push({
			id,
			name: str(raw['name']) ?? '<frame>',
			line: num(raw['line']) ?? 0,
			column: num(raw['column']) ?? 0,
			...(source ? { source: { ...(path ? { path } : {}), ...(name ? { name } : {}) } } : {}),
		});
	}
	return out;
}

export function toScopes(value: unknown): Scope[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).map((s) => ({
		name: str(s['name']) ?? 'Scope',
		variablesReference: num(s['variablesReference']) ?? 0,
		expensive: s['expensive'] === true,
	}));
}

export function toVariables(value: unknown): Variable[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).map((v) => {
		const type = str(v['type']);
		const evaluateName = str(v['evaluateName']);
		return {
			name: str(v['name']) ?? '',
			value: str(v['value']) ?? '',
			variablesReference: num(v['variablesReference']) ?? 0,
			...(type ? { type } : {}),
			...(evaluateName ? { evaluateName } : {}),
		};
	});
}

export function toEvaluateResult(body: Record<string, unknown>): EvaluateResult {
	const type = str(body['type']);
	return {
		result: str(body['result']) ?? '',
		variablesReference: num(body['variablesReference']) ?? 0,
		...(type ? { type } : {}),
	};
}

export function toCapabilities(body: Record<string, unknown>): Capabilities {
	const flag = (key: keyof Capabilities): boolean => body[key] === true;
	const filters = Array.isArray(body['exceptionBreakpointFilters'])
		? body['exceptionBreakpointFilters'].filter(isRecord).map((f) => ({
				filter: str(f['filter']) ?? '',
				label: str(f['label']) ?? str(f['filter']) ?? '',
				default: f['default'] === true,
			}))
		: [];
	return {
		supportsConditionalBreakpoints: flag('supportsConditionalBreakpoints'),
		supportsHitConditionalBreakpoints: flag('supportsHitConditionalBreakpoints'),
		supportsLogPoints: flag('supportsLogPoints'),
		supportsEvaluateForHovers: flag('supportsEvaluateForHovers'),
		supportsExceptionInfoRequest: flag('supportsExceptionInfoRequest'),
		supportsSetVariable: flag('supportsSetVariable'),
		exceptionBreakpointFilters: filters.filter((f) => f.filter !== ''),
	};
}
