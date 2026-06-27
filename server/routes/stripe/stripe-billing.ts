import { getStripe } from '../../config/stripe.js';
import { STRIPE_PLAN } from '../../config/billing.js';

export async function createCustomer(args: {
	email: string;
	name: string;
	storeId: string;
}): Promise<string> {
	const customer = await getStripe().customers.create({
		email: args.email,
		name: args.name,
		metadata: { store_id: args.storeId },
	});
	return customer.id;
}

type StartedSubscription = {
	subscriptionId: string;
	clientSecret: string;
	trialEndsAt: Date | null;
};

// Starts trialing subscription + a SetupIntent so card is saved before trial ends
export async function startSubscription(
	customerId: string,
	priceId: string,
): Promise<StartedSubscription | null> {
	const subscription = await getStripe().subscriptions.create({
		customer: customerId,
		items: [{ price: priceId }],
		trial_period_days: STRIPE_PLAN.trialDays,
		payment_behavior: 'default_incomplete',
		payment_settings: { save_default_payment_method: 'on_subscription' },
		trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
		expand: ['pending_setup_intent'],
	});

	const setupIntent = subscription.pending_setup_intent;
	if (
		!setupIntent ||
		typeof setupIntent === 'string' ||
		!setupIntent.client_secret
	) {
		return null;
	}

	return {
		subscriptionId: subscription.id,
		clientSecret: setupIntent.client_secret,
		trialEndsAt: subscription.trial_end
			? new Date(subscription.trial_end * 1000)
			: null,
	};
}

// Keeps access through the paid period, then stops the renewal
export async function cancelSubscription(
	subscriptionId: string,
): Promise<void> {
	await getStripe().subscriptions.update(subscriptionId, {
		cancel_at_period_end: true,
	});
}

export async function resumeSubscription(
	subscriptionId: string,
): Promise<void> {
	await getStripe().subscriptions.update(subscriptionId, {
		cancel_at_period_end: false,
	});
}

export type CardSummary = { brand: string; last4: string };

export async function getDefaultCard(
	subscriptionId: string,
): Promise<CardSummary | null> {
	const subscription = await getStripe().subscriptions.retrieve(
		subscriptionId,
		{
			expand: ['default_payment_method'],
		},
	);

	const card = subscription.default_payment_method;
	if (!card || typeof card === 'string' || !card.card) return null;

	return { brand: card.card.brand, last4: card.card.last4 };
}

export async function createSetupIntent(
	customerId: string,
): Promise<string | null> {
	const intent = await getStripe().setupIntents.create({
		customer: customerId,
		payment_method_types: ['card'],
		usage: 'off_session',
	});
	return intent.client_secret;
}

export async function setDefaultPaymentMethod(
	subscriptionId: string,
	customerId: string,
	paymentMethodId: string,
): Promise<void> {
	await getStripe().subscriptions.update(subscriptionId, {
		default_payment_method: paymentMethodId,
	});
	await getStripe().customers.update(customerId, {
		invoice_settings: { default_payment_method: paymentMethodId },
	});
}
