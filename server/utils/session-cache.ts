const TTL_MS = 30 * 60 * 1000; // 30 minutes

type CacheEntry = {
	userId: string;
	expiresAt: number;
};

const sessionCache = new Map<string, CacheEntry>();

export function getCachedUserId(refreshToken: string): string | null {
	const entry = sessionCache.get(refreshToken);
	if (!entry) return null;

	if (entry.expiresAt < Date.now()) {
		sessionCache.delete(refreshToken);
		return null;
	}

	return entry.userId;
}

export function setCachedUserId(refreshToken: string, userId: string): void {
	sessionCache.set(refreshToken, {
		userId,
		expiresAt: Date.now() + TTL_MS,
	});
}

export function deleteCachedUserId(refreshToken: string): void {
	sessionCache.delete(refreshToken);
}
