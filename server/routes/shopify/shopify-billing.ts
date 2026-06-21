import { shopifyGraphql } from './shopify-graphql.js';

export type BillingPlan = {
	name: string;
	price: string;
	currencyCode: string;
	interval: string;
	trialDays: number;
};

export type CreatedSubscription = {
	id: string;
	status: string;
	confirmationUrl: string;
};

export type ActiveSubscription = {
	id: string;
	status: string;
	currentPeriodEnd: string | null;
	trialDays: number;
	createdAt: string;
};

const CREATE_MUTATION = `
	mutation CreateSub($name: String!, $returnUrl: URL!, $trialDays: Int!, $test: Boolean!, $lineItems: [AppSubscriptionLineItemInput!]!) {
		appSubscriptionCreate(name: $name, returnUrl: $returnUrl, trialDays: $trialDays, test: $test, lineItems: $lineItems) {
			appSubscription { id status }
			confirmationUrl
			userErrors { field message }
		}
	}`;

type CreateData = {
	appSubscriptionCreate: {
		appSubscription: { id: string; status: string } | null;
		confirmationUrl: string | null;
		userErrors: { field: string[]; message: string }[];
	};
};

export async function createAppSubscription(
	shop: string,
	token: string,
	plan: BillingPlan,
	returnUrl: string,
	test: boolean,
): Promise<CreatedSubscription | null> {
	const data = await shopifyGraphql<CreateData>(shop, token, CREATE_MUTATION, {
		name: plan.name,
		returnUrl,
		trialDays: plan.trialDays,
		test,
		lineItems: [
			{
				plan: {
					appRecurringPricingDetails: {
						price: { amount: plan.price, currencyCode: plan.currencyCode },
						interval: plan.interval,
					},
				},
			},
		],
	});

	const result = data.appSubscriptionCreate;
	if (!result.appSubscription || !result.confirmationUrl) return null;

	return {
		id: result.appSubscription.id,
		status: result.appSubscription.status,
		confirmationUrl: result.confirmationUrl,
	};
}

const ACTIVE_QUERY = `
	query {
		currentAppInstallation {
			activeSubscriptions { id status currentPeriodEnd trialDays createdAt }
		}
	}`;

type ActiveData = {
	currentAppInstallation: {
		activeSubscriptions: ActiveSubscription[];
	};
};

export async function getActiveSubscription(
	shop: string,
	token: string,
): Promise<ActiveSubscription | null> {
	const data = await shopifyGraphql<ActiveData>(shop, token, ACTIVE_QUERY, {});
	return data.currentAppInstallation.activeSubscriptions[0] ?? null;
}

const CANCEL_MUTATION = `
	mutation CancelSub($id: ID!) {
		appSubscriptionCancel(id: $id) {
			appSubscription { id status }
			userErrors { field message }
		}
	}`;

type CancelData = {
	appSubscriptionCancel: {
		appSubscription: { id: string; status: string } | null;
		userErrors: { field: string[]; message: string }[];
	};
};

export async function cancelAppSubscription(
	shop: string,
	token: string,
	subscriptionId: string,
): Promise<{ id: string; status: string } | null> {
	const data = await shopifyGraphql<CancelData>(shop, token, CANCEL_MUTATION, {
		id: subscriptionId,
	});
	return data.appSubscriptionCancel.appSubscription ?? null;
}
