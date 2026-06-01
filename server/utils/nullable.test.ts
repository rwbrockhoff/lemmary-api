import { describe, it, expect } from 'vitest';
import { applyOrNull } from './nullable.js';

describe('applyOrNull', () => {
	it('returns null when value is null', () => {
		expect(applyOrNull(null, (n: number) => n * 2)).toBeNull();
	});

	it('returns null when value is undefined', () => {
		expect(applyOrNull(undefined, (n: number) => n * 2)).toBeNull();
	});

	it('runs the transform when value is present', () => {
		expect(applyOrNull(5, (n) => n * 2)).toBe(10);
	});

	it('still runs the transform on falsy non-null values like 0', () => {
		expect(applyOrNull(0, (n) => n + 1)).toBe(1);
		expect(applyOrNull('', (s) => `${s}value`)).toBe('value');
	});

	it('preserves the transformed type', () => {
		const result = applyOrNull('5', Number);
		expect(result).toBe(5);
	});
});
