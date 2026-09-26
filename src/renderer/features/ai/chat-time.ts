/** When a reply was written: the time today, or the date too for older history. */
export function formatReplyTime(at: number, now: number = Date.now()): string {
	const when = new Date(at);
	const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	if (when.toDateString() === new Date(now).toDateString()) return time;
	const sameYear = when.getFullYear() === new Date(now).getFullYear();
	const date = when.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		...(sameYear ? {} : { year: 'numeric' }),
	});
	return `${date} ${time}`;
}
