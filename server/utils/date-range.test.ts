import { describe, it, expect } from 'vitest';
import { resolveDateRange } from './date-range.js';

describe('resolveDateRange', () => {
	it('uses store-timezone day boundaries with an exclusive end', () => {
		const r = resolveDateRange('2026-06-01', '2026-06-30', 'America/Denver');
		// midnight MDT (UTC-6) on June 1
		expect(r.start.toISOString()).toBe('2026-06-01T06:00:00.000Z');
		// exclusive end = midnight MDT on July 1, so all of June 30 is included
		expect(r.end.toISOString()).toBe('2026-07-01T06:00:00.000Z');
	});

	it('prior window is the equal-length span immediately before', () => {
		const r = resolveDateRange('2026-06-01', '2026-06-30', 'America/Denver');
		const span = r.end.getTime() - r.start.getTime();
		expect(r.priorEnd.getTime()).toBe(r.start.getTime());
		expect(r.start.getTime() - r.priorStart.getTime()).toBe(span);
	});

	it('counts inclusive days', () => {
		expect(resolveDateRange('2026-06-01', '2026-06-30', 'UTC').days).toBe(30);
	});

	it('derives the bucket from span length', () => {
		expect(resolveDateRange('2026-06-01', '2026-06-15', 'UTC').bucket).toBe(
			'day',
		);
		expect(resolveDateRange('2026-04-01', '2026-06-30', 'UTC').bucket).toBe(
			'week',
		);
		expect(resolveDateRange('2026-01-01', '2026-12-31', 'UTC').bucket).toBe(
			'month',
		);
	});
});
