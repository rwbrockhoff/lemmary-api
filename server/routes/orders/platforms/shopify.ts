import type { NewOrder, NewOrderItem } from '../../../db/database-types.js';
import {
	shopifyGraphql,
	type MoneySet,
	type Connection,
	type PageInfo,
} from '../../shopify/shopify-graphql.js';
import type { NormalizedOrder } from './order-types.js';

// The types below mirror exactly the fields we ask for in ORDERS_QUERY
type ShopifyLineItem = {
	id: string;
	sku: string | null;
	title: string;
	quantity: number;
	variantTitle: string | null;
	originalUnitPriceSet: MoneySet;
	image: { url: string } | null;
};

type ShopifyOrder = {
	id: string;
	name: string;
	email: string | null;
	createdAt: string;
	note: string | null;
	displayFulfillmentStatus: string;
	customer: { firstName: string | null; lastName: string | null } | null;
	subtotalPriceSet: MoneySet | null;
	totalShippingPriceSet: MoneySet | null;
	totalDiscountsSet: MoneySet | null;
	totalPriceSet: MoneySet;
	discountCodes: string[];
	shippingLine: { title: string } | null;
	fulfillments: {
		createdAt: string;
		trackingInfo: {
			number: string | null;
			url: string | null;
			company: string | null;
		}[];
	}[];
	lineItems: Connection<ShopifyLineItem>;
};

type OrdersResponse = {
	orders: Connection<ShopifyOrder> & { pageInfo: PageInfo };
};

// We only ask for the fields we map below (GraphQL)
const ORDERS_QUERY = `
	query Orders($cursor: String, $query: String) {
		orders(first: 100, after: $cursor, query: $query) {
			edges {
				node {
					id
					name
					email
					createdAt
					note
					displayFulfillmentStatus
					customer { firstName lastName }
					subtotalPriceSet { shopMoney { amount } }
					totalShippingPriceSet { shopMoney { amount } }
					totalDiscountsSet { shopMoney { amount } }
					totalPriceSet { shopMoney { amount currencyCode } }
					discountCodes
					shippingLine { title }
					fulfillments(first: 1) {
						createdAt
						trackingInfo(first: 1) { number url company }
					}
					lineItems(first: 100) {
						edges {
							node {
								id
								sku
								title
								quantity
								variantTitle
								originalUnitPriceSet { shopMoney { amount } }
								image { url }
							}
						}
					}
				}
			}
			pageInfo { hasNextPage endCursor }
		}
	}
`;

function normalizeOrder(node: ShopifyOrder): NormalizedOrder {
	const customerName = [node.customer?.firstName, node.customer?.lastName]
		.filter(Boolean)
		.join(' ');

	// Shopify only fulfills via fulfillment records, so the first one carries the
	// fulfilled date + tracking
	// trackingInfo is itself a list, hence the [0]
	const fulfillment = node.fulfillments[0];
	const tracking = fulfillment?.trackingInfo[0];

	const order: Omit<NewOrder, 'store_id'> = {
		platform_order_id: node.id,
		order_number: node.name,
		customer_name: customerName,
		customer_email: node.email || null,
		order_date: new Date(node.createdAt),
		// Shopify has a ton of status options, we're only using a few within Lemmary right now
		fulfillment_status:
			node.displayFulfillmentStatus === 'FULFILLED' ? 'fulfilled' : 'pending',
		subtotal: node.subtotalPriceSet?.shopMoney.amount ?? null,
		shipping_total: node.totalShippingPriceSet?.shopMoney.amount ?? null,
		grand_total: node.totalPriceSet?.shopMoney.amount ?? null,
		promo_code: node.discountCodes?.[0] ?? null,
		discount_total: node.totalDiscountsSet?.shopMoney.amount ?? '0',
		currency: node.totalPriceSet?.shopMoney.currencyCode ?? 'USD',
		fulfilled_at: fulfillment ? new Date(fulfillment.createdAt) : null,
		tracking_number: tracking?.number ?? null,
		tracking_url: tracking?.url ?? null,
		carrier_name: tracking?.company ?? null,
		shipping_method: node.shippingLine?.title ?? null,
		order_notes: node.note || null,
	};

	// Line items come back as a connection, so unwrap edges -> node before mapping
	const items: Omit<NewOrderItem, 'order_id'>[] = node.lineItems.edges.map(
		({ node: item }) => ({
			platform_line_item_id: item.id,
			platform_sku: item.sku || null,
			product_name: item.title,
			// Shopify gives one combined variant string -> wrap it to match our shape
			variant_label: item.variantTitle
				? [{ name: 'Variant', value: item.variantTitle }]
				: null,
			quantity: item.quantity,
			unit_price: item.originalUnitPriceSet?.shopMoney.amount ?? null,
			image_url: item.image?.url ?? null,
		}),
	);

	return { order, items };
}

export async function fetchShopifyOrders(
	shop: string,
	token: string,
	lastSyncedAt: Date | null,
): Promise<NormalizedOrder[]> {
	// On a re-sync, only pull orders touched since last time (Shopify's search syntax).
	const query = lastSyncedAt
		? `updated_at:>='${lastSyncedAt.toISOString()}'`
		: null;

	const allOrders: NormalizedOrder[] = [];
	let cursor: string | null = null;

	do {
		const data: OrdersResponse = await shopifyGraphql(
			shop,
			token,
			ORDERS_QUERY,
			{ cursor, query },
		);

		for (const edge of data.orders.edges) {
			allOrders.push(normalizeOrder(edge.node));
		}

		cursor = data.orders.pageInfo.hasNextPage
			? data.orders.pageInfo.endCursor
			: null;
	} while (cursor);

	return allOrders;
}
