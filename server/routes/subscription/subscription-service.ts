import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { DEMO_USER_ID } from '../../config/constants.js';
import { SHOPIFY_PLAN, STRIPE_PLAN } from '../../config/billing.js';
import {
	getStoreForUser,
	getStoreWithAccessToken,
	getStoreByShopDomain,
	getShopDomain,
} from '../../utils/store.js';
import { ensureFreshShopifyToken } from '../shopify/shopify-token.js';
import {
	createAppSubscription,
	getActiveSubscription,
	cancelAppSubscription,
} from '../shopify/shopify-billing.js';
import { isDevelopmentStore } from '../shopify/shopify-service.js';
import {
	createCustomer,
	startSubscription,
	cancelSubscription as stripeCancel,
	resumeSubscription as stripeResume,
	getDefaultCard,
	createSetupIntent,
	setDefaultPaymentMethod,
	type CardSummary,
} from '../stripe/stripe-billing.js';
import type { SubscriptionStatus } from '../../db/enums.js';

type SubscriptionProvider = 'shopify' | 'stripe';

const DAY_MS = 86_400_000;

type SubscriptionView = {
	access: boolean;
	subscribed: boolean;
	status: SubscriptionStatus | null;
	planName: string | null;
	price: string | null;
	trialEndsAt: string | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
};

type CreateResult =
	| { ok: true; provider: 'shopify'; confirmationUrl: string }
	| { ok: true; provider: 'stripe'; clientSecret: string }
	| { ok: false; error: 'no_store' | 'not_configured' | 'create_failed' };

type CancelResult =
	| { ok: true }
	| { ok: false; error: 'no_store' | 'no_subscription' | 'cancel_failed' };

type ResumeResult =
	| { ok: true }
	| {
			ok: false;
			error: 'no_store' | 'no_subscription' | 'not_supported';
	  };

const NOT_SUBSCRIBED: SubscriptionView = {
	access: false,
	subscribed: false,
	status: null,
	planName: null,
	price: null,
	trialEndsAt: null,
	currentPeriodEnd: null,
	cancelAtPeriodEnd: false,
};

// Shopify status -> our normalized set
const SHOPIFY_STATUS: Record<string, SubscriptionStatus> = {
	ACTIVE: 'active',
	DECLINED: 'declined',
	EXPIRED: 'expired',
	FROZEN: 'frozen',
	CANCELLED: 'cancelled',
};

function normalizeStatus(shopifyStatus: string): SubscriptionStatus {
	return SHOPIFY_STATUS[shopifyStatus] ?? 'pending';
}

async function upsertSubscription(args: {
	storeId: string;
	provider: SubscriptionProvider;
	providerSubscriptionId: string;
	providerCustomerId?: string | null;
	status: SubscriptionStatus;
	planName: string;
	price: string;
	currency: string;
	trialEndsAt: Date | null;
	currentPeriodEnd: Date | null;
}) {
	await db
		.insertInto('subscriptions')
		.values({
			store_id: args.storeId,
			provider: args.provider,
			provider_subscription_id: args.providerSubscriptionId,
			provider_customer_id: args.providerCustomerId ?? null,
			status: args.status,
			plan_name: args.planName,
			price: args.price,
			currency: args.currency,
			trial_ends_at: args.trialEndsAt,
			current_period_end: args.currentPeriodEnd,
		})
		.onConflict((oc) =>
			oc.column('store_id').doUpdateSet({
				provider: args.provider,
				provider_subscription_id: args.providerSubscriptionId,
				provider_customer_id: args.providerCustomerId ?? null,
				status: args.status,
				trial_ends_at: args.trialEndsAt,
				current_period_end: args.currentPeriodEnd,
				updated_at: new Date(),
			}),
		)
		.execute();
}

// Shopify stores approve a charge on Shopify, everyone else pays through Stripe
export async function createSubscription(
	userId: string,
): Promise<CreateResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	if (store.platform === 'shopify') return createShopifySubscription(userId);
	return createStripeSubscription(userId, store.id, store.store_name);
}

// Returns URL where store approves charge in their Shopify admin
async function createShopifySubscription(
	userId: string,
): Promise<CreateResult> {
	const store = await getStoreWithAccessToken(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const token = await ensureFreshShopifyToken(store);
	const shop = getShopDomain(store);

	// Dev stores only accept test charges, real stores get a real one
	const test =
		env.NODE_ENV !== 'production' || (await isDevelopmentStore(shop, token));

	const created = await createAppSubscription(
		shop,
		token,
		SHOPIFY_PLAN,
		`${env.API_URL}/subscription/callback`,
		test,
	);
	if (!created) return { ok: false, error: 'create_failed' };

	await upsertSubscription({
		storeId: store.id,
		provider: 'shopify',
		providerSubscriptionId: created.id,
		status: normalizeStatus(created.status),
		planName: SHOPIFY_PLAN.name,
		price: SHOPIFY_PLAN.price,
		currency: SHOPIFY_PLAN.currencyCode,
		trialEndsAt: null,
		currentPeriodEnd: null,
	});

	return {
		ok: true,
		provider: 'shopify',
		confirmationUrl: created.confirmationUrl,
	};
}

// Returns the client secret the frontend uses to collect a card with the Payment Element
async function createStripeSubscription(
	userId: string,
	storeId: string,
	storeName: string,
): Promise<CreateResult> {
	if (!env.STRIPE_PRICE_ID) return { ok: false, error: 'not_configured' };

	const existing = await db
		.selectFrom('subscriptions')
		.select('provider_customer_id')
		.where('store_id', '=', storeId)
		.executeTakeFirst();

	const user = await db
		.selectFrom('users')
		.select(['email', 'first_name', 'last_name'])
		.where('id', '=', userId)
		.executeTakeFirst();

	const name =
		[user?.first_name, user?.last_name].filter(Boolean).join(' ') || storeName;

	const customerId =
		existing?.provider_customer_id ??
		(await createCustomer({ email: user?.email ?? '', name, storeId }));

	const started = await startSubscription(customerId, env.STRIPE_PRICE_ID);
	if (!started) return { ok: false, error: 'create_failed' };

	// Stays pending until webhook confirms card was saved
	await upsertSubscription({
		storeId,
		provider: 'stripe',
		providerSubscriptionId: started.subscriptionId,
		providerCustomerId: customerId,
		status: 'pending',
		planName: STRIPE_PLAN.name,
		price: STRIPE_PLAN.price,
		currency: STRIPE_PLAN.currency,
		trialEndsAt: started.trialEndsAt,
		currentPeriodEnd: null,
	});

	return { ok: true, provider: 'stripe', clientSecret: started.clientSecret };
}

// Called on the return from Shopify to record the now approved subscription
export async function activateSubscription(userId: string): Promise<boolean> {
	const store = await getStoreWithAccessToken(userId);
	if (!store || store.platform !== 'shopify') return false;

	const token = await ensureFreshShopifyToken(store);
	const active = await getActiveSubscription(getShopDomain(store), token);
	if (!active) return false;

	const trialEndsAt =
		active.trialDays > 0
			? new Date(
					new Date(active.createdAt).getTime() + active.trialDays * DAY_MS,
				)
			: null;

	await upsertSubscription({
		storeId: store.id,
		provider: 'shopify',
		providerSubscriptionId: active.id,
		status: normalizeStatus(active.status),
		planName: SHOPIFY_PLAN.name,
		price: SHOPIFY_PLAN.price,
		currency: SHOPIFY_PLAN.currencyCode,
		trialEndsAt,
		currentPeriodEnd: active.currentPeriodEnd
			? new Date(active.currentPeriodEnd)
			: null,
	});

	return true;
}

export async function cancelSubscription(
	userId: string,
): Promise<CancelResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	if (store.platform === 'shopify') return cancelShopifySubscription(userId);
	return cancelStripeSubscription(store.id);
}

// Shopify cancels right away, there's no resume so they resubscribe instead
async function cancelShopifySubscription(
	userId: string,
): Promise<CancelResult> {
	const store = await getStoreWithAccessToken(userId);
	if (!store) return { ok: false, error: 'no_store' };

	const sub = await db
		.selectFrom('subscriptions')
		.select('provider_subscription_id')
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!sub?.provider_subscription_id) {
		return { ok: false, error: 'no_subscription' };
	}

	const token = await ensureFreshShopifyToken(store);
	const cancelled = await cancelAppSubscription(
		getShopDomain(store),
		token,
		sub.provider_subscription_id,
	);
	if (!cancelled) return { ok: false, error: 'cancel_failed' };

	await db
		.updateTable('subscriptions')
		.set({ status: normalizeStatus(cancelled.status), updated_at: new Date() })
		.where('store_id', '=', store.id)
		.execute();

	return { ok: true };
}

// Stripe cancels at period end so the user has access until then
async function cancelStripeSubscription(
	storeId: string,
): Promise<CancelResult> {
	const sub = await db
		.selectFrom('subscriptions')
		.select('provider_subscription_id')
		.where('store_id', '=', storeId)
		.executeTakeFirst();

	if (!sub?.provider_subscription_id) {
		return { ok: false, error: 'no_subscription' };
	}

	await stripeCancel(sub.provider_subscription_id);

	await db
		.updateTable('subscriptions')
		.set({ cancel_at_period_end: true, updated_at: new Date() })
		.where('store_id', '=', storeId)
		.execute();

	return { ok: true };
}

// Undo a pending Stripe cancellation before period ends
export async function resumeSubscription(
	userId: string,
): Promise<ResumeResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };
	if (store.platform === 'shopify')
		return { ok: false, error: 'not_supported' };

	const sub = await db
		.selectFrom('subscriptions')
		.select('provider_subscription_id')
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!sub?.provider_subscription_id) {
		return { ok: false, error: 'no_subscription' };
	}

	await stripeResume(sub.provider_subscription_id);

	await db
		.updateTable('subscriptions')
		.set({ cancel_at_period_end: false, updated_at: new Date() })
		.where('store_id', '=', store.id)
		.execute();

	return { ok: true };
}

export async function getSubscription(
	userId: string,
): Promise<SubscriptionView> {
	const access = await hasAppAccess(userId);
	const store = await getStoreForUser(userId);
	if (!store) return { ...NOT_SUBSCRIBED, access };

	const sub = await db
		.selectFrom('subscriptions')
		.selectAll()
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!sub) return { ...NOT_SUBSCRIBED, access };

	return {
		access,
		subscribed: sub.status === 'active',
		status: sub.status,
		planName: sub.plan_name,
		price: sub.price,
		trialEndsAt: sub.trial_ends_at?.toISOString() ?? null,
		currentPeriodEnd: sub.current_period_end?.toISOString() ?? null,
		cancelAtPeriodEnd: sub.cancel_at_period_end,
	};
}

// Whether a user can use the app
export async function hasAppAccess(userId: string): Promise<boolean> {
	// Demo showcase always allowed
	if (userId === DEMO_USER_ID) return true;

	// Free access we granted directly
	const grant = await db
		.selectFrom('account_grants')
		.select('id')
		.where('user_id', '=', userId)
		.where((eb) =>
			eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())]),
		)
		.executeTakeFirst();
	if (grant) return true;

	const store = await getStoreForUser(userId);
	if (!store) return false;

	// Otherwise an active subscription
	const sub = await db
		.selectFrom('subscriptions')
		.select('status')
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	return sub?.status === 'active';
}

// Webhook: sync status when Shopify changes a subscription
export async function syncShopifySubscription(
	subscriptionGid: string,
	shopifyStatus: string,
): Promise<void> {
	await db
		.updateTable('subscriptions')
		.set({ status: normalizeStatus(shopifyStatus), updated_at: new Date() })
		.where('provider_subscription_id', '=', subscriptionGid)
		.execute();
}

// Webhook: sync status when Stripe changes a subscription
export async function syncStripeSubscription(args: {
	providerSubscriptionId: string;
	status: SubscriptionStatus;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	trialEndsAt: Date | null;
}): Promise<void> {
	await db
		.updateTable('subscriptions')
		.set({
			status: args.status,
			current_period_end: args.currentPeriodEnd,
			cancel_at_period_end: args.cancelAtPeriodEnd,
			trial_ends_at: args.trialEndsAt,
			updated_at: new Date(),
		})
		.where('provider_subscription_id', '=', args.providerSubscriptionId)
		.execute();
}

// Webhook: app uninstalled, cancel billing but keep their data for a reinstall
export async function cancelSubscriptionByShop(shop: string): Promise<void> {
	const store = await getStoreByShopDomain(shop);
	if (!store) return;

	await db
		.updateTable('subscriptions')
		.set({ status: 'cancelled', updated_at: new Date() })
		.where('store_id', '=', store.id)
		.execute();
}

type StripeSubRow = { subscriptionId: string; customerId: string };

async function getStripeSubRow(userId: string): Promise<StripeSubRow | null> {
	const store = await getStoreForUser(userId);
	if (!store || store.platform === 'shopify') return null;

	const sub = await db
		.selectFrom('subscriptions')
		.select(['provider_subscription_id', 'provider_customer_id'])
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!sub?.provider_subscription_id || !sub.provider_customer_id) return null;

	return {
		subscriptionId: sub.provider_subscription_id,
		customerId: sub.provider_customer_id,
	};
}

export async function getPaymentMethod(
	userId: string,
): Promise<CardSummary | null> {
	const row = await getStripeSubRow(userId);
	if (!row) return null;
	return getDefaultCard(row.subscriptionId);
}

// Returns a client secret the frontend uses to collect the new card
export async function startPaymentMethodUpdate(
	userId: string,
): Promise<string | null> {
	const row = await getStripeSubRow(userId);
	if (!row) return null;
	return createSetupIntent(row.customerId);
}

export async function updatePaymentMethod(
	userId: string,
	paymentMethodId: string,
): Promise<boolean> {
	const row = await getStripeSubRow(userId);
	if (!row) return false;
	await setDefaultPaymentMethod(
		row.subscriptionId,
		row.customerId,
		paymentMethodId,
	);
	return true;
}
