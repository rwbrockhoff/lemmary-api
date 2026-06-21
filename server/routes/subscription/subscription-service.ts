import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { DEMO_USER_ID } from '../../config/constants.js';
import { SHOPIFY_PLAN } from '../../config/billing.js';
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
import type { SubscriptionStatus } from '../../db/enums.js';

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
	| { ok: true; confirmationUrl: string }
	| { ok: false; error: 'no_store' | 'not_shopify' | 'create_failed' };

type CancelResult =
	| { ok: true }
	| { ok: false; error: 'no_store' | 'no_subscription' | 'cancel_failed' };

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
function normalizeStatus(shopifyStatus: string): SubscriptionStatus {
	switch (shopifyStatus) {
		case 'ACTIVE':
			return 'active';
		case 'DECLINED':
			return 'declined';
		case 'EXPIRED':
			return 'expired';
		case 'FROZEN':
			return 'frozen';
		case 'CANCELLED':
			return 'cancelled';
		default:
			return 'pending';
	}
}

async function upsertSubscription(args: {
	storeId: string;
	providerSubscriptionId: string;
	status: SubscriptionStatus;
	trialEndsAt: Date | null;
	currentPeriodEnd: Date | null;
}) {
	await db
		.insertInto('subscriptions')
		.values({
			store_id: args.storeId,
			provider: 'shopify',
			provider_subscription_id: args.providerSubscriptionId,
			status: args.status,
			plan_name: SHOPIFY_PLAN.name,
			price: SHOPIFY_PLAN.price,
			currency: SHOPIFY_PLAN.currencyCode,
			trial_ends_at: args.trialEndsAt,
			current_period_end: args.currentPeriodEnd,
		})
		.onConflict((oc) =>
			oc.column('store_id').doUpdateSet({
				provider_subscription_id: args.providerSubscriptionId,
				status: args.status,
				trial_ends_at: args.trialEndsAt,
				current_period_end: args.currentPeriodEnd,
				updated_at: new Date(),
			}),
		)
		.execute();
}

// Starts a Shopify subscription and returns the URL where the merchant approves it
export async function createSubscription(
	userId: string,
): Promise<CreateResult> {
	const store = await getStoreWithAccessToken(userId);
	if (!store) return { ok: false, error: 'no_store' };
	if (store.platform !== 'shopify') return { ok: false, error: 'not_shopify' };

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
		providerSubscriptionId: created.id,
		status: normalizeStatus(created.status),
		trialEndsAt: null,
		currentPeriodEnd: null,
	});

	return { ok: true, confirmationUrl: created.confirmationUrl };
}

// Called on the return from Shopify to record the now-approved subscription
export async function activateSubscription(userId: string): Promise<boolean> {
	const store = await getStoreWithAccessToken(userId);
	if (!store || store.platform !== 'shopify') return false;

	const token = await ensureFreshShopifyToken(store);
	const active = await getActiveSubscription(getShopDomain(store), token);
	if (!active) return false;

	const trialEndsAt =
		active.trialDays > 0
			? new Date(new Date(active.createdAt).getTime() + active.trialDays * DAY_MS)
			: null;

	await upsertSubscription({
		storeId: store.id,
		providerSubscriptionId: active.id,
		status: normalizeStatus(active.status),
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
	const store = await getStoreWithAccessToken(userId);
	if (!store || store.platform !== 'shopify') {
		return { ok: false, error: 'no_store' };
	}

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
