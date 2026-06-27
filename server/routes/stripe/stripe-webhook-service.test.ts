import { describe, it, expect } from 'vitest';
import { normalizeStripeStatus } from './stripe-webhook-service.js';

describe('normalizeStripeStatus', () => {
	it('marks a trialing sub active once a card is saved', () => {
		expect(normalizeStripeStatus('trialing', true)).toBe('active');
	});

	it('keeps a trialing sub pending until a card is saved', () => {
		expect(normalizeStripeStatus('trialing', false)).toBe('pending');
	});

	it('marks an active sub active with a card', () => {
		expect(normalizeStripeStatus('active', true)).toBe('active');
	});

	it('keeps an active sub pending without a card', () => {
		expect(normalizeStripeStatus('active', false)).toBe('pending');
	});

	it('freezes payment problem statuses', () => {
		expect(normalizeStripeStatus('past_due', true)).toBe('frozen');
		expect(normalizeStripeStatus('unpaid', true)).toBe('frozen');
		expect(normalizeStripeStatus('paused', true)).toBe('frozen');
	});

	it('maps canceled to cancelled', () => {
		expect(normalizeStripeStatus('canceled', true)).toBe('cancelled');
	});

	it('maps incomplete_expired to expired', () => {
		expect(normalizeStripeStatus('incomplete_expired', false)).toBe('expired');
	});

	it('treats anything unresolved as pending', () => {
		expect(normalizeStripeStatus('incomplete', false)).toBe('pending');
	});
});
