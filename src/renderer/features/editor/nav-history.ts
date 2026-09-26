/**
 * Back / forward through places you've been (Alt+← / Alt+→): file switches and big jumps
 * inside a file (go to definition, search results, outline clicks).
 */
export interface Place {
	path: string;
	line: number;
	column: number;
}

const MAX = 60;
/** A move this many lines away counts as a jump worth remembering. */
export const JUMP_LINES = 12;

export class NavHistory {
	private back: Place[] = [];
	private forward: Place[] = [];
	private current: Place | null = null;
	/**
	 * Where Back / Forward is taking us: arriving there isn't a new jump. Any other place clears
	 * it, so a target that never reports (already there, file failed to open) can't swallow the
	 * next real jump.
	 */
	private target: Place | null = null;

	/** Called on every settled cursor position. */
	visit(place: Place): void {
		const cur = this.current;
		this.current = place;
		const target = this.target;
		this.target = null;
		if (target && target.path === place.path && Math.abs(target.line - place.line) < JUMP_LINES)
			return;
		if (!cur) return;
		const jumped = cur.path !== place.path || Math.abs(cur.line - place.line) >= JUMP_LINES;
		if (!jumped) return;
		const last = this.back.at(-1);
		if (!last || last.path !== cur.path || last.line !== cur.line) this.back.push(cur);
		if (this.back.length > MAX) this.back.shift();
		this.forward = [];
	}

	goBack(): Place | null {
		const target = this.back.pop();
		if (!target) return null;
		if (this.current) this.forward.push(this.current);
		this.target = target;
		return target;
	}

	goForward(): Place | null {
		const target = this.forward.pop();
		if (!target) return null;
		if (this.current) this.back.push(this.current);
		this.target = target;
		return target;
	}

	/** The file (or a folder, with everything in it) was deleted or renamed: drop its places. */
	forget(path: string): void {
		const gone = (p: Place): boolean => p.path === path || p.path.startsWith(`${path}/`);
		this.back = this.back.filter((p) => !gone(p));
		this.forward = this.forward.filter((p) => !gone(p));
		if (this.target && gone(this.target)) this.target = null;
	}

	/** Another folder was opened: its places mean nothing there. */
	clear(): void {
		this.back = [];
		this.forward = [];
		this.current = null;
		this.target = null;
	}

	get canGoBack(): boolean {
		return this.back.length > 0;
	}
}

export const navHistory = new NavHistory();
