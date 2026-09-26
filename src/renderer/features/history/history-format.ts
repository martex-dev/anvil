/** "just now", "5 min ago", "3 h ago", "2 d ago": a snapshot's age at `now`. */
export function ago(ms: number, now: number): string {
	const s = (now - ms) / 1000;
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
	return `${Math.floor(s / 86_400)} d ago`;
}

export const bytes = (n: number): string => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
