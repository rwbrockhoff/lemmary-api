import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	getCachedUserId,
	setCachedUserId,
	deleteCachedUserId,
} from './session-cache.js';

const TOKEN = 'token-abc';
const USER_ID = 'user-123';

describe('session-cache', () => {
	beforeEach(() => {
		deleteCachedUserId(TOKEN);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null when no entry exists for the token', () => {
		expect(getCachedUserId('missing-token')).toBeNull();
	});

	it('returns the cached userId after set', () => {
		setCachedUserId(TOKEN, USER_ID);
		expect(getCachedUserId(TOKEN)).toBe(USER_ID);
	});

	it('returns null and evicts the entry once the TTL has passed', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

		setCachedUserId(TOKEN, USER_ID);
		expect(getCachedUserId(TOKEN)).toBe(USER_ID);

		vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
		expect(getCachedUserId(TOKEN)).toBeNull();
		expect(getCachedUserId(TOKEN)).toBeNull();
	});

	it('overwrites the existing entry on a fresh set', () => {
		setCachedUserId(TOKEN, USER_ID);
		setCachedUserId(TOKEN, 'user-456');
		expect(getCachedUserId(TOKEN)).toBe('user-456');
	});

	it('removes the entry on delete', () => {
		setCachedUserId(TOKEN, USER_ID);
		deleteCachedUserId(TOKEN);
		expect(getCachedUserId(TOKEN)).toBeNull();
	});
});
