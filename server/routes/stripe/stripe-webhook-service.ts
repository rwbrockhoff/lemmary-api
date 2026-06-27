import type Stripe from 'stripe';
import { getStripe } from '../../config/stripe.js';
import { env } from '../../config/environment.js';
import type { SubscriptionStatus } from '../../db/enums.js';

export function constructStripeEvent(
	rawBody: string | Buffer,
	signature: string,
): Stripe.Event {
	return getStripe().webhooks.constructEvent(
		rawBody,
		signature,
		env.STRIPE_WEBHOOK_SECRET ?? '',
	);
}

// Stripe status -> our set
// Trial or active sub only counts once the card is saved
export function normalizeStripeStatus(
	status: Stripe.Subscription.Status,
	hasPaymentMethod: boolean,
): SubscriptionStatus {
	switch (status) {
		case 'trialing':
		case 'active':
			return hasPaymentMethod ? 'active' : 'pending';
		case 'past_due':
		case 'unpaid':
		case 'paused':
			return 'frozen';
		case 'canceled':
			return 'cancelled';
		case 'incomplete_expired':
			return 'expired';
		default:
			return 'pending';
	}
}
