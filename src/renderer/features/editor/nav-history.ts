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
	private navigating = false;

	/** Called on every settled cursor position. */
	visit(place: Place): void {
		const cur = this.current;
		this.current = place;
		if (this.navigating) {
			this.navigating = false;
			return;
		}
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
		this.navigating = true;
		return target;
	}

	goForward(): Place | null {
		const target = this.forward.pop();
		if (!target) return null;
		if (this.current) this.back.push(this.current);
		this.navigating = true;
		return target;
	}

	/** The file was closed or renamed away: drop its places. */
	forget(path: string): void {
		this.back = this.back.filter((p) => p.path !== path);
		this.forward = this.forward.filter((p) => p.path !== path);
	}

	get canGoBack(): boolean {
		return this.back.length > 0;
	}
}

export const navHistory = new NavHistory();
