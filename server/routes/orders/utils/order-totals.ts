type LineItem = {
	quantity: number;
	unit_price?: string | null;
};

export function sumLineItems(items: LineItem[]): string | null {
	const priced = items.filter((item) => item.unit_price != null);
	if (priced.length === 0) return null;

	const total = priced.reduce(
		(sum, item) => sum + Number(item.unit_price) * item.quantity,
		0,
	);
	return total.toFixed(2);
}
