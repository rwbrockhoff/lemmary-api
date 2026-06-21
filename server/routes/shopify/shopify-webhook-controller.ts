import type { FastifyRequest, FastifyReply } from 'fastify';
import { Sentry } from '../../config/sentry.js';
import { deleteStoreByShopDomain } from '../store/store-service.js';
import {
	redactCustomerData,
	type ShopRedactPayload,
	type CustomerRedactPayload,
	type CustomerDataRequestPayload,
	type AppSubscriptionUpdatePayload,
	type AppUninstalledPayload,
} from './shopify-webhook-service.js';
import {
	syncShopifySubscription,
	cancelSubscriptionByShop,
} from '../subscription/subscription-service.js';

export async function handleShopRedact(
	request: FastifyRequest<{ Body: ShopRedactPayload }>,
	reply: FastifyReply,
) {
	const { shop_domain } = request.body;
	const removed = await deleteStoreByShopDomain(shop_domain);

	request.log.info(
		{ shop: shop_domain, removed },
		'Shopify shop/redact handled',
	);

	return reply.code(200).send({ received: true });
}

export async function handleCustomersRedact(
	request: FastifyRequest<{ Body: CustomerRedactPayload }>,
	reply: FastifyReply,
) {
	const { shop_domain, customer } = request.body;
	const redacted = customer.email
		? await redactCustomerData(shop_domain, customer.email, customer.id)
		: 0;

	request.log.info(
		{ shop: shop_domain, redacted },
		'Shopify customers/redact handled',
	);

	return reply.code(200).send({ received: true });
}

// We log the request and raise it in Sentry, handled in 30-days manually
// Next phase: handle customer data request with automated export
export async function handleCustomersDataRequest(
	request: FastifyRequest<{ Body: CustomerDataRequestPayload }>,
	reply: FastifyReply,
) {
	const { shop_domain, customer, data_request } = request.body;

	// Reference customer by Shopify's id, never by email
	const context = {
		shop: shop_domain,
		customerId: customer.id,
		requestId: data_request?.id,
	};

	request.log.warn(context, 'Shopify customers/data_request received');

	Sentry.captureMessage('Shopify customer data request received', {
		level: 'error',
		tags: { shop: shop_domain, topic: 'data_request' },
		extra: context,
	});

	return reply.code(200).send({ received: true });
}

export async function handleAppSubscriptionUpdate(
	request: FastifyRequest<{ Body: AppSubscriptionUpdatePayload }>,
	reply: FastifyReply,
) {
	const { app_subscription } = request.body;
	await syncShopifySubscription(
		app_subscription.admin_graphql_api_id,
		app_subscription.status,
	);

	request.log.info(
		{ status: app_subscription.status },
		'Shopify app_subscriptions/update handled',
	);

	return reply.code(200).send({ received: true });
}

export async function handleAppUninstalled(
	request: FastifyRequest<{ Body: AppUninstalledPayload }>,
	reply: FastifyReply,
) {
	const { myshopify_domain } = request.body;
	await cancelSubscriptionByShop(myshopify_domain);

	request.log.info({ shop: myshopify_domain }, 'Shopify app/uninstalled handled');

	return reply.code(200).send({ received: true });
}
