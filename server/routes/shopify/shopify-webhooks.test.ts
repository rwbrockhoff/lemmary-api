import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../tests/test-helpers.js';
import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { SHOPIFY_USER_ID } from '../../tests/test-constants.js';
import { createShopifyStore } from '../store/store-service.js';
import { getStoreByShopDomain } from '../../utils/store.js';
import { SHOPIFY_WEBHOOK_PATHS } from './shopify-config.js';

const sign = (body: string) =>
	createHmac('sha256', env.SHOPIFY_CLIENT_SECRET ?? '')
		.update(body, 'utf8')
		.digest('base64');

const postWebhook = (
	app: FastifyInstance,
	path: string,
	payload: object,
	hmac?: string,
) => {
	const body = JSON.stringify(payload);
	return app.inject({
		method: 'POST',
		url: path,
		headers: {
			'content-type': 'application/json',
			'x-shopify-hmac-sha256': hmac ?? sign(body),
		},
		payload: body,
	});
};

const seedUser = () =>
	db
		.insertInto('users')
		.values({
			id: SHOPIFY_USER_ID,
			email: 'webhook-test@example.com',
			first_name: 'Webhook',
			last_name: 'Test',
		})
		.execute();

const cleanup = async () => {
	await db
		.deleteFrom('stores')
		.where('user_id', '=', SHOPIFY_USER_ID)
		.execute();
	await db.deleteFrom('users').where('id', '=', SHOPIFY_USER_ID).execute();
};

describe('Shopify Compliance Webhooks', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('rejects a webhook with an invalid signature', async () => {
		const response = await postWebhook(
			app,
			SHOPIFY_WEBHOOK_PATHS.shopRedact,
			{ shop_id: 1, shop_domain: 'nope.myshopify.com' },
			'not-a-real-signature',
		);

		expect(response.statusCode).toBe(401);
	});

	it('shop/redact removes the store and its data', async () => {
		const shop = 'redact-shop-test.myshopify.com';
		await seedUser();

		try {
			await createShopifyStore(SHOPIFY_USER_ID, shop, 'token');

			const response = await postWebhook(
				app,
				SHOPIFY_WEBHOOK_PATHS.shopRedact,
				{
					shop_id: 1,
					shop_domain: shop,
				},
			);

			expect(response.statusCode).toBe(200);
			expect(await getStoreByShopDomain(shop)).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('customers/redact scrubs the customer PII on matching orders', async () => {
		const shop = 'redact-customer-test.myshopify.com';
		await seedUser();

		try {
			await createShopifyStore(SHOPIFY_USER_ID, shop, 'token');
			const store = await getStoreByShopDomain(shop);

			await db
				.insertInto('orders')
				.values({
					store_id: store!.id,
					platform_order_id: 'wh-order-1',
					order_number: '#WH1',
					customer_name: 'Jane Doe',
					customer_email: 'jane@example.com',
					order_date: new Date(),
				})
				.execute();

			const response = await postWebhook(
				app,
				SHOPIFY_WEBHOOK_PATHS.customersRedact,
				{ shop_domain: shop, customer: { id: 99, email: 'jane@example.com' } },
			);

			expect(response.statusCode).toBe(200);

			const order = await db
				.selectFrom('orders')
				.select(['customer_name', 'customer_email'])
				.where('store_id', '=', store!.id)
				.executeTakeFirstOrThrow();

			expect(order.customer_name).toBe('[redacted]');
			expect(order.customer_email).toBeNull();
		} finally {
			await cleanup();
		}
	});

	it('customers/data_request acknowledges with 200', async () => {
		const response = await postWebhook(
			app,
			SHOPIFY_WEBHOOK_PATHS.customersDataRequest,
			{
				shop_domain: 'data-request-test.myshopify.com',
				customer: { id: 5, email: 'someone@example.com' },
				data_request: { id: 123 },
			},
		);

		expect(response.statusCode).toBe(200);
	});
});
