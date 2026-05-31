import { describe, it, expect } from 'vitest';
import { computeCustomerTier } from './customer-tier.js';

describe('computeCustomerTier', () => {
	it('returns new for first-time customers (0 or 1 orders)', () => {
		expect(computeCustomerTier(0)).toBe('new');
		expect(computeCustomerTier(1)).toBe('new');
	});

	it('returns loyal for repeat customers (2-4 orders)', () => {
		expect(computeCustomerTier(2)).toBe('loyal');
		expect(computeCustomerTier(3)).toBe('loyal');
		expect(computeCustomerTier(4)).toBe('loyal');
	});

	it('returns super_fan for high-volume customers (5+ orders)', () => {
		expect(computeCustomerTier(5)).toBe('super_fan');
		expect(computeCustomerTier(20)).toBe('super_fan');
	});
});
