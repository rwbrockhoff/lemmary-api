import { describe, it, expect } from 'vitest';
import { gateRows, gateSummary } from './report-gates.js';

describe('gateRows', () => {
	it('returns the rows when data and row count both clear the minimums', () => {
		expect(gateRows([1, 2, 3], true, 3)).toEqual([1, 2, 3]);
	});

	it('returns empty when there is not enough underlying data', () => {
		expect(gateRows([1, 2, 3], false, 3)).toEqual([]);
	});

	it('returns empty when there are fewer rows than the minimum', () => {
		expect(gateRows([1, 2], true, 3)).toEqual([]);
	});
});

describe('gateSummary', () => {
	it('returns the section when totalCount meets the minimum', () => {
		const section = { totalCount: 5, returningCount: 3 };
		expect(gateSummary(section, 5)).toEqual(section);
	});

	it('returns null when totalCount is below the minimum', () => {
		expect(gateSummary({ totalCount: 4 }, 5)).toBeNull();
	});
});
