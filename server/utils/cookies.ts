import type { CookieSerializeOptions } from '@fastify/cookie';
import { env } from '../config/environment.js';
import { REFRESH_TOKEN_MAX_AGE } from '../config/constants.js';

const isProduction = env.NODE_ENV === 'production';
const domain = isProduction ? '.lemmary.com' : undefined;

export const refreshCookieOptions: CookieSerializeOptions = {
	signed: true,
	httpOnly: true,
	secure: isProduction,
	sameSite: 'lax',
	domain,
	path: '/',
	maxAge: REFRESH_TOKEN_MAX_AGE,
};

export const clearRefreshCookieOptions: CookieSerializeOptions = {
	path: '/',
	domain,
};
