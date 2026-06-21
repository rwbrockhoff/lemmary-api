import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import { env } from '../../config/environment.js';
import {
	createSubscription,
	cancelSubscription,
	getSubscription,
	activateSubscription,
} from './subscription-service.js';

export async function handleGetSubscription(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const view = await getSubscription(request.userId);
	return successResponse(reply, view);
}

export async function handleCreateSubscription(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await createSubscription(request.userId);

	if (!result.ok) {
		if (result.error === 'no_store') {
			throw AppError.badRequest('Connect a store before subscribing.');
		}
		if (result.error === 'not_shopify') {
			throw AppError.badRequest(
				'Billing is only available for Shopify stores.',
			);
		}
		throw new AppError('Could not start the subscription.');
	}

	return successResponse(reply, { confirmationUrl: result.confirmationUrl });
}

export async function handleCancelSubscription(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await cancelSubscription(request.userId);

	if (!result.ok) {
		if (result.error === 'no_subscription') {
			throw AppError.badRequest('No subscription to cancel.');
		}
		throw new AppError('Could not cancel the subscription.');
	}

	return successResponse(reply, null, 'Subscription cancelled');
}

// Shopify sends the merchant back here after they approve the charge
// Webhook is the source of truth, so activation failure just logs and moves on
export async function handleSubscriptionCallback(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		await activateSubscription(request.userId);
	} catch (err) {
		request.log.error(err, 'Subscription activation failed');
	}

	return reply.redirect(`${env.FRONTEND_URL}/?subscribed=1`);
}
