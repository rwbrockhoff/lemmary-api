import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../db/connection.js';
import {
	TEST_USER_ID,
	TEST_STORE_ID,
	SHOPIFY_USER_ID,
	NON_APP_USER_ID,
} from '../../tests/test-constants.js';
import { createShopifyStore } from '../store/store-service.js';
import { createSubscription } from './subscription-service.js';

// Mock Stripe API layer so branch returns a client secret
vi.mock('../stripe/stripe-billing.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../stripe/stripe-billing.js')>()),
	createCustomer: vi.fn().mockResolvedValue('cus_test123'),
	startSubscription: vi.fn().mockResolvedValue({
		subscriptionId: 'sub_test123',
		clientSecret: 'seti_test_secret',
		trialEndsAt: null,
	}),
}));

// Mock Shopify billing call so branch returns a confirmation url
vi.mock('../shopify/shopify-billing.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../shopify/shopify-billing.js')>()),
	createAppSubscription: vi.fn().mockResolvedValue({
		id: 'gid://shopify/AppSubscription/1',
		status: 'PENDING',
		confirmationUrl: 'https://test.myshopify.com/confirm',
	}),
}));

vi.mock('../shopify/shopify-token.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../shopify/shopify-token.js')>()),
	ensureFreshShopifyToken: vi.fn().mockResolvedValue('shop-token'),
}));

// createShopifyStore reaches out for the shop timezone, skip it in tests
vi.mock('../shopify/shopify-service.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../shopify/shopify-service.js')>()),
	fetchShopTimezone: vi.fn().mockResolvedValue(null),
}));

const SHOPIFY_SHOP = 'sub-branch-test.myshopify.com';

describe('createSubscription provider routing', () => {
	beforeAll(async () => {
		await db
			.insertInto('users')
			.values({
				id: SHOPIFY_USER_ID,
				email: 'sub-branch@example.com',
				first_name: 'Sub',
				last_name: 'Branch',
			})
			.execute();

		await createShopifyStore(SHOPIFY_USER_ID, SHOPIFY_SHOP, {
			accessToken: 'token',
			refreshToken: 'refresh',
			expiresIn: 3600,
		});
	});

	afterAll(async () => {
		await db
			.deleteFrom('subscriptions')
			.where('store_id', '=', TEST_STORE_ID)
			.execute();
		await db
			.deleteFrom('stores')
			.where('user_id', '=', SHOPIFY_USER_ID)
			.execute();
		await db.deleteFrom('users').where('id', '=', SHOPIFY_USER_ID).execute();
	});

	it('returns no_store when the user has no store', async () => {
		const result = await createSubscription(NON_APP_USER_ID);
		expect(result).toEqual({ ok: false, error: 'no_store' });
	});

	it('routes a non-Shopify store to Stripe with a client secret', async () => {
		const result = await createSubscription(TEST_USER_ID);
		expect(result).toMatchObject({
			ok: true,
			provider: 'stripe',
			clientSecret: 'seti_test_secret',
		});
	});

	it('routes a Shopify store to Shopify with a confirmation url', async () => {
		const result = await createSubscription(SHOPIFY_USER_ID);
		expect(result).toMatchObject({
			ok: true,
			provider: 'shopify',
			confirmationUrl: 'https://test.myshopify.com/confirm',
		});
	});
});
