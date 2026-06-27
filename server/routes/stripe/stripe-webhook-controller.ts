import type { FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';
import {
	constructStripeEvent,
	normalizeStripeStatus,
} from './stripe-webhook-service.js';
import { syncStripeSubscription } from '../subscription/subscription-service.js';

export async function handleStripeWebhook(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const signature = request.headers['stripe-signature'];
	if (typeof signature !== 'string') {
		return reply.code(400).send({ error: 'Missing signature' });
	}

	let event: Stripe.Event;
	try {
		event = constructStripeEvent(request.rawBody ?? '', signature);
	} catch (err) {
		request.log.warn({ err }, 'Stripe webhook signature check failed');
		return reply.code(400).send({ error: 'Invalid signature' });
	}

	if (
		event.type === 'customer.subscription.created' ||
		event.type === 'customer.subscription.updated' ||
		event.type === 'customer.subscription.deleted'
	) {
		await syncSubscription(event.data.object);
		request.log.info(
			{ type: event.type, status: event.data.object.status },
			'Stripe webhook handled',
		);
	}

	return reply.code(200).send({ received: true });
}

async function syncSubscription(subscription: Stripe.Subscription) {
	const status = normalizeStripeStatus(
		subscription.status,
		Boolean(subscription.default_payment_method),
	);

	const periodEnd = subscription.items.data[0]?.current_period_end ?? null;

	await syncStripeSubscription({
		providerSubscriptionId: subscription.id,
		status,
		currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		trialEndsAt: subscription.trial_end
			? new Date(subscription.trial_end * 1000)
			: null,
	});
}
