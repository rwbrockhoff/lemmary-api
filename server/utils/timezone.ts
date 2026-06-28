// Midnight of the day `date` lands on, in the given timezone
// Lets day-based math (due dates, day counts) follow store's timezone (not server)

export function startOfDayUtc(date: Date, timeZone: string): Date {
	const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone })
		.format(date)
		.split('-')
		.map(Number);

	return new Date(Date.UTC(year, month - 1, day));
}

// noon UTC so the picked day reads the same across zones
export function toNoonUtc(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
	);
}

// True when the runtime recognizes the timezone name (e.g. America/Denver)
export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}
