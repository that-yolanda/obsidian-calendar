export function formatMinutes(m: number, roundToHour = false): string {
	const prefix = m < 0 ? "-" : "";
	const abs = Math.abs(m);
	if (roundToHour) {
		const h = Math.round(abs / 60);
		return `${prefix}${h}h`;
	}
	const h = Math.floor(abs / 60);
	const min = abs % 60;
	const parts: string[] = [];
	if (h > 0) parts.push(`${h}h`);
	if (min > 0) parts.push(`${min}m`);
	if (parts.length === 0) parts.push("0m");
	return `${prefix}${parts.join(" ")}`;
}

export function parseTimeToMinutes(time: string): number {
	const parts = time.split(":");
	return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

export function formatDate(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
