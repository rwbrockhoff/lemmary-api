import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import { env } from '../../config/environment.js';
import {
	createSubscription,
	cancelSubscription,
	resumeSubscription,
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
		throw new AppError('Could not start the subscription.');
	}

	if (result.provider === 'shopify') {
		return successResponse(reply, { confirmationUrl: result.confirmationUrl });
	}

	return successResponse(reply, { clientSecret: result.clientSecret });
}

export async function handleCancelSubscription(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await cancelSubscription(request.userId);

	if (!result.ok) {
		if (result.error === 'no_store' || result.error === 'no_subscription') {
			throw AppError.badRequest('No subscription to cancel.');
		}
		throw new AppError('Could not cancel the subscription.');
	}

	return successResponse(reply, null, 'Subscription cancelled');
}

export async function handleResumeSubscription(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await resumeSubscription(request.userId);

	if (!result.ok) {
		if (result.error === 'not_supported') {
			throw AppError.badRequest('Resuming is managed in your Shopify admin.');
		}
		if (result.error === 'no_store' || result.error === 'no_subscription') {
			throw AppError.badRequest('No subscription to resume.');
		}
		throw new AppError('Could not resume the subscription.');
	}

	return successResponse(reply, null, 'Subscription resumed');
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
