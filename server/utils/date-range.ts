export type RangeBucket = 'day' | 'week' | 'month';

export type ResolvedRange = {
	start: Date;
	end: Date;
	priorStart: Date;
	priorEnd: Date;
	days: number;
	bucket: RangeBucket;
};

// timezone offset in ms (local minus UTC) at the instant
function tzOffsetMs(instant: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(instant);

	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second'),
	);
	return asUtc - instant.getTime();
}

// midnight of a calendar day in the timezone, as a UTC instant
function zonedDayStartUtc(dateStr: string, timeZone: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number);
	const utcGuess = Date.UTC(year, month - 1, day);
	const offset = tzOffsetMs(new Date(utcGuess), timeZone);
	return new Date(utcGuess - offset);
}

function nextDay(dateStr: string): string {
	const [year, month, day] = dateStr.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day + 1))
		.toISOString()
		.slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

const bucketForDays = (days: number): RangeBucket => {
	if (days <= 31) return 'day';
	if (days <= 92) return 'week';
	return 'month';
};

// store local day bounds to UTC, end exclusive, plus the equal prior window
export function resolveDateRange(
	startDate: string,
	endDate: string,
	timeZone: string,
): ResolvedRange {
	const start = zonedDayStartUtc(startDate, timeZone);
	const end = zonedDayStartUtc(nextDay(endDate), timeZone);
	const durationMs = end.getTime() - start.getTime();

	return {
		start,
		end,
		priorStart: new Date(start.getTime() - durationMs),
		priorEnd: start,
		days: Math.round(durationMs / DAY_MS),
		bucket: bucketForDays(durationMs / DAY_MS),
	};
}
