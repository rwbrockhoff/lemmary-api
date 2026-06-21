import { env } from './environment.js';

export const DEV_USER_ID = env.DEV_USER_ID;
export const DEV_STORE_ID = env.DEV_STORE_ID;

export const DEMO_USER_ID = env.DEMO_USER_ID;
export const DEMO_STORE_ID = env.DEMO_STORE_ID;
export const DEMO_SESSION_TOKEN = 'demo-session-readonly';

export const SHOPIFY_TEST_USER_ID = 'a0e18681-1bf6-44f8-8f6b-7b5e680535a0';
export const SHOPIFY_TEST_EMAIL = 'shopify@lemmary.com';

export const REFRESH_TOKEN_COOKIE = 'refresh-token';
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const TEST_AUTH_HEADER = 'x-test-user-id';
