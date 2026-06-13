import { describe, it, expect } from 'vitest';
import { startOfDayUtc, isValidTimeZone } from './timezone.js';

describe('startOfDayUtc', () => {
	it('rolls back to the previous day for a negative-offset zone', () => {
		// 02:00 UTC is still yesterday evening in Denver (UTC-6 in summer)
		const instant = new Date('2026-06-13T02:00:00Z');
		expect(startOfDayUtc(instant, 'America/Denver').toISOString()).toBe(
			'2026-06-12T00:00:00.000Z',
		);
	});

	it('rolls forward to the next day for a positive-offset zone', () => {
		// 23:00 UTC is already the next morning in Tokyo
		const instant = new Date('2026-06-12T23:00:00Z');
		expect(startOfDayUtc(instant, 'Asia/Tokyo').toISOString()).toBe(
			'2026-06-13T00:00:00.000Z',
		);
	});

	it('returns the same calendar day when the zone is UTC', () => {
		const instant = new Date('2026-06-13T02:00:00Z');
		expect(startOfDayUtc(instant, 'UTC').toISOString()).toBe(
			'2026-06-13T00:00:00.000Z',
		);
	});
});

describe('isValidTimeZone', () => {
	it('accepts a known timezone name', () => {
		expect(isValidTimeZone('America/Denver')).toBe(true);
		expect(isValidTimeZone('UTC')).toBe(true);
	});

	it('rejects an unknown timezone name', () => {
		expect(isValidTimeZone('America/NotARealPlace')).toBe(false);
		expect(isValidTimeZone('')).toBe(false);
	});
});
