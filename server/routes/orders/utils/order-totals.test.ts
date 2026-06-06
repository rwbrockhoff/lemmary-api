import { describe, it, expect } from 'vitest';
import { sumLineItems } from './order-totals.js';

describe('sumLineItems', () => {
	it('sums quantity times unit price across items', () => {
		expect(
			sumLineItems([
				{ quantity: 2, unit_price: '45.00' },
				{ quantity: 1, unit_price: '10.50' },
			]),
		).toBe('100.50');
	});

	it('returns null when no item has a price', () => {
		expect(
			sumLineItems([{ quantity: 2, unit_price: null }, { quantity: 1 }]),
		).toBeNull();
	});

	it('ignores items without a price', () => {
		expect(
			sumLineItems([
				{ quantity: 2, unit_price: '20.00' },
				{ quantity: 5, unit_price: null },
			]),
		).toBe('40.00');
	});
});
