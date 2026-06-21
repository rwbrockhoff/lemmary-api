import { SHOPIFY_API_VERSION } from './shopify-config.js';

// Shared Shopify GraphQL shapes: money is always { shopMoney: { amount, currencyCode } }
// and every list is a connection of { edges: [{ node }] } with a pageInfo cursor.
export type Money = { amount: string; currencyCode: string };
export type MoneySet = { shopMoney: Money };
export type Connection<T> = { edges: { node: T }[] };
export type PageInfo = { hasNextPage: boolean; endCursor: string | null };

// One GraphQL POST to the Shopify Admin API
// GraphQL returns HTTP 200 even when the query fails,
// so the real errors live in an `errors` array in the body
export async function shopifyGraphql<T>(
	shop: string,
	token: string,
	query: string,
	variables: Record<string, unknown>,
): Promise<T> {
	const response = await fetch(
		`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Shopify-Access-Token': token,
			},
			body: JSON.stringify({ query, variables }),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Shopify API error ${response.status}: ${text}`);
	}

	const body = (await response.json()) as { data?: T; errors?: unknown };
	if (body.errors || !body.data) {
		throw new Error(`Shopify GraphQL error: ${JSON.stringify(body.errors)}`);
	}

	return body.data;
}
