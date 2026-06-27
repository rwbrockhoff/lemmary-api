// Reporting chart gates: hide chart unless it has enough data

// List chart shows only with enough underlying records and enough rows
export function gateRows<T>(
	rows: T[],
	hasEnoughData: boolean,
	minRows: number,
): T[] {
	if (!hasEnoughData) return [];
	if (rows.length < minRows) return [];
	return rows;
}

// Summary chart shows only with enough orders/customers
export function gateSummary<T extends { totalCount: number }>(
	section: T,
	minCount: number,
): T | null {
	if (section.totalCount < minCount) return null;
	return section;
}
